/**
 * 液化玻璃折射效果的 SVG 滤镜定义，供 GlassSurface 的 backdrop-filter: url(#glass-distortion) 引用。
 * 只需要在应用里挂载一次（放在 App 根部），尺寸为 0 不占布局空间。
 */
export function GlassDistortionFilter(): React.JSX.Element {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="glass-distortion">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
