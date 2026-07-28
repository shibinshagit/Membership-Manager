export function PoweredByOpenCoders({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-center text-xs text-muted-foreground'}>
      Powered by{' '}
      <a
        href="https://opencoders.icu"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        OpenCoders
      </a>
    </p>
  );
}
