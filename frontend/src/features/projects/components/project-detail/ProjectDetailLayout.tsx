type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export default function ProjectDetailLayout({ sidebar, children }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 18,
        alignItems: "start",
      }}
    >
      {sidebar}
      <section style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
        {children}
      </section>
    </div>
  );
}