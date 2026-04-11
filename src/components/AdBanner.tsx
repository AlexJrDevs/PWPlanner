import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

interface Props {
  adSlot: string
  adFormat?: 'auto' | 'vertical' | 'horizontal' | 'rectangle'
}

const isDev = import.meta.env.DEV

export default function AdBanner({ adSlot, adFormat = 'auto' }: Props) {
  const insRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!insRef.current || isDev) return
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.error('AdSense error:', e)
    }
  }, [adSlot])

  const isHorizontal = adFormat === 'horizontal'

  const style = isHorizontal
    ? { width: '100%', height: '50px' }
    : { width: '140px', minHeight: '600px' }

  if (isDev) {
    return (
      <div
        style={style}
        className="flex items-center justify-center bg-gray-800 border border-dashed border-gray-600 rounded text-[10px] text-gray-500 font-mono"
      >
        ad · {adSlot}
      </div>
    )
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client="ca-pub-XXXXXXXXXX"
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={isHorizontal ? 'true' : 'false'}
    />
  )
}