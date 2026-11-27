export function BrandMark({ name }: { name: string }) {
  const placed = name === "Placed";
  return (
    <span className="brand">
      <span className={placed ? "mark mark-placed" : "mark mark-posfin"} aria-hidden="true" />
      <span>{name}</span>
    </span>
  );
}
