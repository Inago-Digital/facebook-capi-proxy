import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react"

import { cn } from "../../utils/cn"

export function DataTable({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse", className)} {...props} />
}

export function TableHeadCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-textMute",
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-border px-5 py-3 align-middle font-mono text-[12px]",
        className,
      )}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-100 hover:bg-surfaceAlt", className)} {...props} />
}

interface EmptyTableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  colSpan: number
}

export function EmptyTableCell({
  className,
  ...props
}: EmptyTableCellProps) {
  return (
    <td
      className={cn(
        "px-5 py-12 text-center font-mono text-[12px] text-textMute",
        className,
      )}
      {...props}
    />
  )
}
