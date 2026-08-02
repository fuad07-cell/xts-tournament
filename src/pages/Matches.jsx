import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { key: 'joined', label: 'চলমান' },
  { key: 'completed', label: 'সম্পন্ন' },
  { key: 'cancelled', label: 'বাতিল' },
]

export default function Matches() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [results, setResults] = useState({}) // entryId -> result doc
  const [tab, setTab] = useState('joined')
  const [resultModalFor, setResultModalFor] = useState(null)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'entries'),
      where('userId', '==', user.uid)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.joinedAt?.toMillis?.() || 0) - (a.joinedAt?.toMillis?.() || 0))
        setEntries(list)
      },
      (err) => console.error('entries fetch error:', err)
    )
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'matchResults'), where('userId', '==', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.data().entryId] = { id: d.id, ...d.data() } })
      setResults(map)
    })
    return unsub
  }, [user])

  const filtered = entries.filter((e) => e.status === tab)

  return (
    <div className="screen">
      <div className="section-title">
        <h2>আমার ম্যাচ</h2>
        <span>{entries.length} এন্ট্রি</span>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>এখানে কিছু নেই</h3>
          <p>Home থেকে পছন্দের মোড বেছে একটা ম্যাচে জয়েন করুন — এখানে তার status দেখতে পাবেন।</p>
        </div>
      ) : (
        <div className="bracket-list">
          {filtered.map((e) => {
            const result = results[e.id]
            return (
              <div className="bracket-row match-entry-row" key={e.id}>
                <div className="row-left">
                  <div>
                    <div className="row-name">{e.title}</div>
                    <div className="row-sub">{e.category}</div>
                  </div>
                </div>
                <div className="row-value">
                  ৳{e.entryFee}
                  <span className="unit">{e.status}</span>
                </div>

                {tab === 'joined' && (
                  <div className="entry-result-action">
                    {!result && (
                      <button className="submit-result-btn" onClick={() => setResultModalFor(e)}>
                        Submit Result
                      </button>
                    )}
                    {result && result.status === 'pending' && (
                      <span className="result-badge pending">Result Review হচ্ছে...</span>
                    )}
                    {result && result.status === 'approved' && (
                      <span className={'result-badge ' + (result.isWinner ? 'win' : 'loss')}>
                        {result.isWinner ? `🏆 জিতেছেন — ৳${result.prizeAmount}` : 'হেরে গেছেন'}
                      </span>
                    )}
                    {result && result.status === 'rejected' && (
                      <span className="result-badge loss">Result গ্রহণযোগ্য হয়নি</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {resultModalFor && (
        <SubmitResultModal
          entry={resultModalFor}
          userId={user.uid}
          onClose={() => setResultModalFor(null)}
        />
      )}
    </div>
  )
}

function SubmitResultModal({ entry, userId, onClose }) {
  const [kills, setKills] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    if (kills === '' || Number(kills) < 0) return alert('কতগুলো kill করেছেন লিখুন (০ হলেও লিখুন)')
    if (!file) return alert('Result screen-এর screenshot আপলোড করুন')

    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!data.success) throw new Error('Screenshot আপলোড করা যায়নি')
      const screenshotURL = data.data.url

      await addDoc(collection(db, 'matchResults'), {
        entryId: entry.id,
        tournamentId: entry.tournamentId,
        userId,
        title: entry.title,
        claimedKills: Number(kills),
        screenshotURL,
        status: 'pending',
        submittedAt: serverTimestamp(),
      })
      alert('Result জমা হয়েছে। Admin verify করার পর ফলাফল দেখা যাবে।')
      onClose()
    } catch (err) {
      alert('জমা দেওয়া যায়নি, আবার চেষ্টা করুন')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>Submit Result</h2>
        <div className="meta">{entry.title}</div>

        <div className="field">
          <label>কতগুলো Kill করেছেন?</label>
          <input type="number" min="0" value={kills} onChange={(e) => setKills(e.target.value)} placeholder="0" />
        </div>

        <div className="field">
          <label>Result Screen-এর Screenshot</label>
          <input type="file" accept="image/*" onChange={handleFile} />
        </div>

        {preview && (
          <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 10, marginBottom: 14 }} />
        )}

        <button className="join-btn" onClick={submit} disabled={busy}>
          {busy ? 'আপলোড হচ্ছে...' : 'SUBMIT RESULT'}
        </button>
      </div>
    </div>
  )
}
