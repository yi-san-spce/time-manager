// SSE streaming probe: does the proxy forward chunks incrementally, or buffer?
// Standalone (no Electron) — same env-var contract as verify-ai-live.mjs.
//   TM_API_KEY=... TM_BASE_URL=https://www.right.codes/claude-aws node scripts/verify-sse-probe.mjs
// Delete after use. Prints inter-chunk gaps; a buffering proxy shows one burst at the end.
import Anthropic from '@anthropic-ai/sdk'

const API_KEY = process.env.TM_API_KEY
const BASE_URL = process.env.TM_BASE_URL
const MODEL = process.env.TM_MODEL || 'claude-sonnet-5'

if (!API_KEY || !BASE_URL) {
  console.error('need TM_API_KEY and TM_BASE_URL env vars')
  process.exit(2)
}

const client = new Anthropic({ apiKey: API_KEY, baseURL: BASE_URL })

const start = Date.now()
const arrivals = [] // ms-since-start of each text/thinking delta
let firstTextAt = null
let thinkingCount = 0
let textChars = 0

const stream = client.messages.stream({
  model: MODEL,
  max_tokens: 512,
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort: 'low' },
  messages: [
    {
      role: 'user',
      content: '用中文从 1 数到 20，每个数字单独一行，只输出数字。'
    }
  ]
})

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    const t = Date.now() - start
    if (event.delta.type === 'thinking_delta') {
      thinkingCount++
      arrivals.push(t)
    } else if (event.delta.type === 'text_delta') {
      if (firstTextAt === null) firstTextAt = t
      textChars += event.delta.text.length
      arrivals.push(t)
    }
  }
}

const final = await stream.finalMessage()
const total = Date.now() - start

// Gaps between consecutive delta arrivals. If SSE is forwarded, we expect many
// distinct arrival times spread across the run; if buffered, arrivals cluster at the end.
const gaps = []
for (let i = 1; i < arrivals.length; i++) gaps.push(arrivals[i] - arrivals[i - 1])
const distinctTimes = new Set(arrivals).size
const spread = arrivals.length ? arrivals[arrivals.length - 1] - arrivals[0] : 0

console.log(JSON.stringify({
  model: final.model,
  stopReason: final.stop_reason,
  totalMs: total,
  deltaCount: arrivals.length,
  thinkingDeltas: thinkingCount,
  textChars,
  firstTextAtMs: firstTextAt,
  lastDeltaAtMs: arrivals.length ? arrivals[arrivals.length - 1] : null,
  arrivalSpreadMs: spread, // time between first and last delta
  distinctArrivalTimes: distinctTimes,
  maxGapMs: gaps.length ? Math.max(...gaps) : null
}, null, 2))

// Heuristic verdict: streaming works if deltas arrive spread out over time,
// not all bunched at the very end.
if (arrivals.length === 0) {
  console.log('[INCONCLUSIVE] no deltas seen (thinking display omitted + no text deltas?)')
} else if (spread > 400 && distinctTimes > 3) {
  console.log(`[PASS] SSE forwarded: ${arrivals.length} deltas over ${spread}ms — incremental streaming works`)
} else {
  console.log(`[BUFFERED] deltas arrived in ${spread}ms burst (${distinctTimes} distinct times) — proxy appears to buffer SSE; finalMessage() still works`)
}
