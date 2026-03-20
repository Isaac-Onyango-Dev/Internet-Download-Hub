import { useState, useEffect } from 'react'

const APP_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub'
const GITHUB_URL = 'https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub'
const SHARE_TITLE = 'Internet Download Hub — Free Video Downloader'
const SHARE_TEXT = 'Check out Internet Download Hub — a free desktop app that downloads videos from YouTube, TikTok, Twitter, Instagram and 1000+ other sites. Completely free and open source.'

interface SharePlatform {
  id: string
  name: string
  color: string
  textColor: string
  icon: string
  getUrl: (url: string, text: string, title: string) => string
}

interface PaymentOption {
  id: string
  name: string
  description: string
  icon: string
  color: string
  region: string
}

const SHARE_PLATFORMS: SharePlatform[] = [
  {
    id: 'twitter',
    name: 'X (Twitter)',
    color: '#000000',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    getUrl: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` 
  },
  {
    id: 'reddit',
    name: 'Reddit',
    color: '#FF4500',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`,
    getUrl: (url, text, title) => `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` 
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
    getUrl: (url, text) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}` 
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` 
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    getUrl: (url, text, title) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(text)}` 
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#2AABEE',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
    getUrl: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` 
  },
  {
    id: 'threads',
    name: 'Threads',
    color: '#000000',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 192 192" fill="currentColor"><path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/></svg>`,
    getUrl: (url, text) => `https://www.threads.net/intent/post?text=${encodeURIComponent(text + ' ' + url)}` 
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    color: '#6364FF',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 216.4 232" fill="currentColor"><path d="M212 139c-3 16-29 34-58 37-15 2-30 3-46 3-26-2-46-7-46-7v8c4 25 26 26 47 27 21 0 39-5 39-5l1 19s-14 8-41 10c-14 1-32-1-53-6C-2 220-7 174-8 128V80C-8 33 22 18 22 18 38 10 65 7 93 7h1C28 0 56 3 72 11 0 0 29 15 29 61 0 0 1 37-10 67"/><path d="M174 80v61h-25V82c0-13-5-19-16-19-12 0-18 8-18 22v33H90V85c0-14-6-22-17-22s-17 6-17 19v59H31V80c0-12 3-22 9-30 7-7 15-11 26-11 12 0 21 5 27 14l6 9 6-9C6-9 15-14 27-14 10 0 19 4 26 11 6 8 9 18 9 30" fill="#fff"/></svg>`,
    getUrl: (url, text) => `https://mastodon.social/share?text=${encodeURIComponent(text + ' ' + url)}` 
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    color: '#FF6600',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896z"/></svg>`,
    getUrl: (url, text, title) => `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}` 
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    color: '#BD081C',
    textColor: '#ffffff',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`,
    getUrl: (url, text) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}` 
  },
]

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    description: 'Pay via Safaricom M-Pesa',
    icon: '📱',
    color: '#00B300',
    region: 'Kenya'
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    description: 'Pay via Airtel Money',
    icon: '📱',
    color: '#FF0000',
    region: 'Kenya'
  },
  {
    id: 'tkash',
    name: 'T-Kash',
    description: 'Pay via Telkom T-Kash',
    icon: '📱',
    color: '#0066CC',
    region: 'Kenya'
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    description: 'Cards, mobile money and more',
    icon: '💳',
    color: '#F5A623',
    region: 'Africa'
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Pay via PayPal',
    icon: '🅿️',
    color: '#0070BA',
    region: 'International'
  },
  {
    id: 'wise',
    name: 'Wise',
    description: 'Bank transfer via Wise',
    icon: '🌍',
    color: '#00B9FF',
    region: 'International'
  },
  {
    id: 'kofi',
    name: 'Ko-fi',
    description: 'Buy me a coffee',
    icon: '☕',
    color: '#FF5E5B',
    region: 'International'
  },
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    description: 'Send BTC to wallet address',
    icon: '₿',
    color: '#F7931A',
    region: 'Crypto'
  },
  {
    id: 'usdt',
    name: 'USDT (Tether)',
    description: 'Send USDT — TRC20 or ERC20',
    icon: '💲',
    color: '#26A17B',
    region: 'Crypto'
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    description: 'Send ETH to wallet address',
    icon: '⟠',
    color: '#627EEA',
    region: 'Crypto'
  },
  {
    id: 'binance',
    name: 'Binance Pay',
    description: 'Pay via Binance account',
    icon: '🔶',
    color: '#F3BA2F',
    region: 'Crypto'
  },
]

export default function Support() {
  const [activeTab, setActiveTab] = useState<'share' | 'support'>('share')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showUnderDev, setShowUnderDev] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentOption | null>(null)
  const [nativeShareSupported, setNativeShareSupported] = useState(false)

  useEffect(() => {
    setNativeShareSupported(typeof navigator !== 'undefined' && !!navigator.share)
  }, [])

  const handleShare = (platform: SharePlatform) => {
    const url = platform.getUrl(APP_URL, SHARE_TEXT, SHARE_TITLE)
    // Open in default browser from Electron
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopiedId('link')
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // Fallback
    }
  }

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n\n${APP_URL}`)
      setCopiedId('message')
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // Fallback
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: SHARE_TITLE,
        text: SHARE_TEXT,
        url: APP_URL
      })
    } catch {}
  }

  const handlePaymentClick = (option: PaymentOption) => {
    setSelectedPayment(option)
    setShowUnderDev(true)
  }

  const handleGitHubSponsors = () => {
    const url = `${GITHUB_URL}` 
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  // Group payment options by region
  const paymentByRegion = PAYMENT_OPTIONS.reduce((acc, opt) => {
    if (!acc[opt.region]) acc[opt.region] = []
    acc[opt.region].push(opt)
    return acc
  }, {} as Record<string, PaymentOption[]>)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-900 p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Support Internet Download Hub</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          This app is built and maintained by one developer. Your support —
          whether sharing it with others or making a donation — directly helps
          keep it free, updated, and improving. Thank you for using it.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('share')}
          className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'share'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📢 Share App
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'support'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ❤️ Support with Donation
        </button>
      </div>

      {/* ── SHARE TAB ────────────────────────────────────────── */}
      {activeTab === 'share' && (
        <div className="space-y-6">

          {/* What you are sharing */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-2 tracking-wide">
              What will be shared
            </p>
            <p className="text-gray-300 text-sm leading-relaxed">{SHARE_TEXT}</p>
            <p className="text-blue-400 text-sm mt-2 break-all">{APP_URL}</p>
          </div>

          {/* Native share — only show if supported */}
          {nativeShareSupported && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-3 bg-blue-600
                         hover:bg-blue-500 text-white font-semibold py-3 px-6
                         rounded-xl transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share via System Share Menu
            </button>
          )}

          {/* Share platforms grid */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3 tracking-wide">
              Share on a platform
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SHARE_PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl
                             font-semibold text-sm transition-all
                             hover:opacity-85 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: platform.color,
                    color: platform.textColor
                  }}
                  dangerouslySetInnerHTML={{
                    __html: `${platform.icon}<span>${platform.name}</span>` 
                  }}
                />
              ))}
            </div>
          </div>

          {/* Copy options */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3 tracking-wide">
              Copy to clipboard
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-gray-700 hover:bg-gray-600 text-white
                           font-semibold text-sm transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                {copiedId === 'link' ? '✅ Link Copied!' : 'Copy App Link'}
              </button>
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-gray-700 hover:bg-gray-600 text-white
                           font-semibold text-sm transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedId === 'message' ? '✅ Message Copied!' : 'Copy Share Message'}
              </button>
            </div>
          </div>

          {/* GitHub star */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4
                          flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">⭐ Star on GitHub</p>
              <p className="text-gray-400 text-xs mt-1">
                Starring helps others discover the project
              </p>
            </div>
            <button
              onClick={handleGitHubSponsors}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-gray-700 hover:bg-gray-600 text-white
                         text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Star on GitHub
            </button>
          </div>

        </div>
      )}

      {/* ── DONATION TAB ──────────────────────────────────────── */}
      {activeTab === 'support' && (
        <div className="space-y-6">

          <div className="bg-amber-900 border border-amber-700 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚧</span>
              <div>
                <p className="text-amber-200 font-semibold text-sm">
                  Donation Support Coming Soon
                </p>
                <p className="text-amber-300 text-xs mt-1 leading-relaxed">
                  Payment integrations are currently under development.
                  All options below will be fully active in a future update.
                  In the meantime, sharing the app is the best way to help.
                </p>
              </div>
            </div>
          </div>

          {/* Payment options grouped by region */}
          {Object.entries(paymentByRegion).map(([region, options]) => (
            <div key={region}>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-3 tracking-wide">
                {region === 'Kenya' ? '🇰🇪 Kenya — Mobile Money' :
                 region === 'Africa' ? '🌍 Africa — Cards and Mobile Money' :
                 region === 'International' ? '🌐 International' :
                 '₿ Cryptocurrency'}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handlePaymentClick(option)}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl
                               bg-gray-800 border border-gray-700
                               hover:border-gray-500 text-white
                               transition-all text-left group"
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-white">{option.name}</p>
                      <p className="text-gray-400 text-xs">{option.description}</p>
                    </div>
                    <span className="text-xs text-amber-400 font-medium
                                     bg-amber-900 border border-amber-700
                                     px-2 py-1 rounded-full whitespace-nowrap">
                      Coming Soon
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

        </div>
      )}

      {/* ── UNDER DEVELOPMENT MODAL ───────────────────────────── */}
      {showUnderDev && selectedPayment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-50
                     flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnderDev(false)
          }}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-2xl
                          p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-5xl mb-4">🚧</div>
            <h3 className="text-white font-bold text-lg mb-2">
              {selectedPayment.name} — Coming Soon
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {selectedPayment.name} support is currently under development
              and will be available in a future update. Thank you for your
              patience and willingness to support the project.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              In the meantime, sharing the app with others is the most
              powerful way to support its growth — and it is completely free.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowUnderDev(false)
                  setActiveTab('share')
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white
                           font-semibold py-3 rounded-xl transition-colors"
              >
                Share App Instead
              </button>
              <button
                onClick={() => setShowUnderDev(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white
                           font-semibold py-3 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
