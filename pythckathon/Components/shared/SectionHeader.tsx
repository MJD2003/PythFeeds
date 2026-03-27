interface SectionHeaderProps {
  title: string;
  description?: string;
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h2 className="text-2xl font-bold text-[var(--cmc-text)]">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-[var(--cmc-text-sub)]">{description}</p>
      )}
    </div>
  );
}
