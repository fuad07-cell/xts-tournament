// Scrolling headline/notice bar shown below the Telegram/YouTube posters.
// Edit NOTICES below to change what it announces — add as many lines as
// you like, they'll all scroll through in one continuous loop.
const NOTICES = [
  '🎉 নতুন টুর্নামেন্ট প্রতিদিন যোগ হচ্ছে — Home থেকে আপনার পছন্দের মোড বেছে নিন!',
  '💰 জয়েন করার আগে Wallet-এ Add Money করে নিন।',
  '📢 যেকোনো সমস্যায় Telegram Support-এ যোগাযোগ করুন।',
]

export default function NoticeTicker() {
  const text = NOTICES.join('   ●   ')
  return (
    <div className="notice-ticker">
      <span className="notice-ticker-badge">📣 NOTICE</span>
      <div className="notice-ticker-track">
        <div className="notice-ticker-track-inner">
          <span className="notice-ticker-text">{text}</span>
          <span className="notice-ticker-text" aria-hidden="true">{text}</span>
        </div>
      </div>
    </div>
  )
}
