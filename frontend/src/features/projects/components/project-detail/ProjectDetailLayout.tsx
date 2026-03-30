type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export default function ProjectDetailLayout({ sidebar, children }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 14,
        alignItems: "start",
      }}
    >
      {sidebar}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </section>
    </div>
  );
}