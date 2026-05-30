// BI section uses #F5F7FB background per design spec
export default function BiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#F5F7FB', minHeight: '100%' }} className="p-0">
      {children}
    </div>
  )
}
