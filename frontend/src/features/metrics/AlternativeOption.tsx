import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import type { MissionAlternative } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';

interface Props {
  alternative: MissionAlternative;
  onApply: (alternative: MissionAlternative) => void;
}

/** Una fecha alternativa: el boton la aplica como nuevo inicio (misma duracion) y al lado va la fecha. */
export function AlternativeOption({ alternative, onApply }: Props) {
  const { landing, shiftDays } = alternative;
  const direction = shiftDays < 0 ? 'earlier' : 'later';

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="sm" onClick={() => onApply(alternative)}>
        Try {formatDuration(Math.abs(shiftDays) * 24)} {direction}
      </Button>
      <span className="text-slate-700 tabular-nums">{formatUtcDateTime(landing)} UTC</span>
    </li>
  );
}
