export function getRowValue(row, field) {
  if (!row || !field) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  if (row.data && Object.prototype.hasOwnProperty.call(row.data, field)) return row.data[field];
  return undefined;
}

function isEmpty(value) {
  return value == null || value === '';
}

function comparable(value) {
  if (typeof value === 'number') return { kind: 'number', value };
  if (typeof value === 'boolean') return { kind: 'number', value: value ? 1 : 0 };
  const text = String(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: 'number', value: Number(text) };
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(text)) {
    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return { kind: 'number', value: timestamp };
  }
  return { kind: 'string', value: text };
}

function compareValues(left, right, direction) {
  const leftEmpty = isEmpty(left);
  const rightEmpty = isEmpty(right);
  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) return 0;
    return leftEmpty ? 1 : -1; // Empty values stay last in both directions.
  }
  const a = comparable(left);
  const b = comparable(right);
  let result;
  if (a.kind === 'number' && b.kind === 'number') result = a.value - b.value;
  else result = String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

export function sortRows(rows, sortConfig) {
  const primary = sortConfig?.field
    ? { field: sortConfig.field, direction: sortConfig.direction === 'desc' ? 'desc' : 'asc' }
    : null;
  const secondary = sortConfig?.secondaryField
    ? { field: sortConfig.secondaryField, direction: sortConfig.secondaryDirection === 'desc' ? 'desc' : 'asc' }
    : null;
  if (!primary) return Array.isArray(rows) ? rows : [];

  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const first = compareValues(
        getRowValue(left.row, primary.field),
        getRowValue(right.row, primary.field),
        primary.direction,
      );
      if (first) return first;
      if (secondary) {
        const second = compareValues(
          getRowValue(left.row, secondary.field),
          getRowValue(right.row, secondary.field),
          secondary.direction,
        );
        if (second) return second;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}
