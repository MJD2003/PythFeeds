"use client";

import { useRef, type CSSProperties } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export type TableColumn<T> = ColumnDef<T, unknown> & {
  textAlign?: CSSProperties["textAlign"];
};

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
}

export default function DataTable<T>({ data, columns }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div
        ref={tableContainerRef}
        className="max-h-[80vh] overflow-auto"
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--cmc-border)]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="sticky top-0 bg-[var(--cmc-bg)] px-2 py-3 text-xs font-semibold text-[var(--cmc-neutral-5)]"
                    style={{
                      width: header.getSize(),
                      textAlign:
                        (header.column.columnDef as TableColumn<T>).textAlign ??
                        "end",
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index] as Row<T>;
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--cmc-border)] transition-colors hover:bg-[var(--cmc-neutral-1)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2 py-3 text-sm text-[var(--cmc-text)]"
                      style={{
                        width: cell.column.getSize(),
                        textAlign:
                          (cell.column.columnDef as TableColumn<T>).textAlign ??
                          "end",
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
