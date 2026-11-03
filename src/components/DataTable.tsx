export interface DataTableProps {
  caption: string
  columns: string[]
  rows: { label: string; cells: (string | number)[] }[]
  corner?: string
}

/** Plain accessible table used as the "view as table" companion to a chart. */
export function DataTable({ caption, columns, rows, corner = '' }: DataTableProps) {
  return (
    <div className="table-scroll">
      <table className="plain-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{corner}</th>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
