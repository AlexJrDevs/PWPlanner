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

    const el = insRef.current
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === 0) return  // still hidden, skip
      observer.disconnect()
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (e) {
        // already pushed, ignore
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [adSlot])

  const isHorizontal = adFormat === 'horizontal'

  const style = isHorizontal
    ? { display: 'block', width: '100%', height: '50px' }
    : { display: 'block', width: '100%', minHeight: '600px' }

  if (isDev) {
    return (
      <div style={style} className="flex items-center justify-center bg-gray-800 border border-dashed border-gray-600 rounded text-[10px] text-gray-500 font-mono">
        ad · {adSlot}
      </div>
    )
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={style}
      data-ad-client="ca-pub-2374676822440423"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}