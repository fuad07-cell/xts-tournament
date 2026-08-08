import { TELEGRAM_SUPPORT_LINK, YOUTUBE_HOWTO_LINK } from '../constants/links'
import { useLanguage } from '../context/LanguageContext'

// The two "poster" cards at the top of Home — Telegram Support & YouTube
// How-to-Play — each opens the configured link in a new tab.
export default function InfoBanners() {
  const { t } = useLanguage()

  return (
    <div className="info-banners">
      <a
        href={TELEGRAM_SUPPORT_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="info-banner telegram"
      >
        <span className="info-banner-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
            <path d="M21.9 4.3 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.5-.2L6.6 12.7 2 11.3c-1-.3-1-1 .2-1.5L20.6 3c.8-.3 1.6.2 1.3 1.3Z"/>
          </svg>
        </span>
        <div>
          <div className="info-banner-title">{t('telegramSupportTitle')}</div>
          <div className="info-banner-sub">{t('chatDirectly')}</div>
        </div>
      </a>

      <a
        href={YOUTUBE_HOWTO_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="info-banner youtube"
      >
        <span className="info-banner-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
            <path d="M22 12s0-3.2-.4-4.7a2.8 2.8 0 0 0-2-2C17.9 5 12 5 12 5s-5.9 0-7.6.3a2.8 2.8 0 0 0-2 2C2 8.8 2 12 2 12s0 3.2.4 4.7a2.8 2.8 0 0 0 2 2C6.1 19 12 19 12 19s5.9 0 7.6-.3a2.8 2.8 0 0 0 2-2C22 15.2 22 12 22 12ZM10 15.5v-7l6 3.5-6 3.5Z"/>
          </svg>
        </span>
        <div>
          <div className="info-banner-title">{t('howToPlay')}</div>
          <div className="info-banner-sub">{t('watchOnYoutube')}</div>
        </div>
      </a>
    </div>
  )
}
