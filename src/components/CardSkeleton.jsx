export default function CardSkeleton({ count = 4 }) {
  return (
    <div className="tour-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}
