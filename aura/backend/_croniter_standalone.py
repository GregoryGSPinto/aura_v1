from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class _Field:
    expression: str
    minimum: int
    maximum: int
    wrap_sunday: bool = False

    def matches(self, value: int) -> bool:
        return value in _parse_field(self.expression, self.minimum, self.maximum, self.wrap_sunday)


def _parse_field(expression: str, minimum: int, maximum: int, wrap_sunday: bool = False) -> set[int]:
    values: set[int] = set()

    for raw_part in expression.split(","):
        part = raw_part.strip()
        if not part:
            raise ValueError("Empty cron field")

        if "/" in part:
            range_part, step_part = part.split("/", 1)
            step = int(step_part)
        else:
            range_part = part
            step = 1

        if step <= 0:
            raise ValueError("Cron step must be positive")

        if range_part == "*":
            start, end = minimum, maximum
        elif "-" in range_part:
            start_text, end_text = range_part.split("-", 1)
            start = int(start_text)
            end = int(end_text)
        else:
            start = end = int(range_part)

        if wrap_sunday:
            if start == 7:
                start = 0
            if end == 7:
                end = 0

        if start < minimum or start > maximum or end < minimum or end > maximum:
            raise ValueError("Cron field out of bounds")

        if start <= end:
            values.update(range(start, end + 1, step))
        else:
            values.update(range(start, maximum + 1, step))
            values.update(range(minimum, end + 1, step))

    return values


class croniter:
    def __init__(self, expression: str, start_time: datetime):
        parts = expression.split()
        if len(parts) != 5:
            raise ValueError("Cron expression must contain exactly 5 fields")

        self._minute = _Field(parts[0], 0, 59)
        self._hour = _Field(parts[1], 0, 23)
        self._day = _Field(parts[2], 1, 31)
        self._month = _Field(parts[3], 1, 12)
        self._weekday = _Field(parts[4], 0, 6, wrap_sunday=True)
        self._start_time = start_time

    def get_next(self, ret_type=datetime):
        next_time = self._start_time.replace(second=0, microsecond=0) + timedelta(minutes=1)
        deadline = next_time + timedelta(days=366 * 5)

        while next_time <= deadline:
            if self._matches(next_time):
                if ret_type is datetime:
                    return next_time
                return ret_type(next_time.timestamp())
            next_time += timedelta(minutes=1)

        raise ValueError("Unable to resolve next cron occurrence")

    def _matches(self, dt: datetime) -> bool:
        month_matches = self._month.matches(dt.month)
        minute_matches = self._minute.matches(dt.minute)
        hour_matches = self._hour.matches(dt.hour)
        day_matches = self._day.matches(dt.day)
        weekday_matches = self._weekday.matches((dt.weekday() + 1) % 7)

        day_is_wildcard = self._day.expression == "*"
        weekday_is_wildcard = self._weekday.expression == "*"

        if day_is_wildcard and weekday_is_wildcard:
            calendar_matches = True
        elif day_is_wildcard:
            calendar_matches = weekday_matches
        elif weekday_is_wildcard:
            calendar_matches = day_matches
        else:
            calendar_matches = day_matches or weekday_matches

        return month_matches and minute_matches and hour_matches and calendar_matches
