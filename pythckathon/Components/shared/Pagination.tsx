"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/Components/ui/button";
import { Separator } from "@/Components/ui/separator";

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  uri: string;
  currentPage?: number;
}

export default function Pagination({
  totalItems,
  itemsPerPage,
  uri,
  currentPage = 1,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const maxVisible = 5;

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <Separator className="mb-6" />
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          Showing {Math.min(itemsPerPage, totalItems)} of {totalItems.toLocaleString()} results
        </p>
        <div className="flex items-center gap-1">
          {currentPage > 1 && (
            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
              <Link href={`${uri}?page=${currentPage - 1}`}>
                <ChevronLeft size={14} />
              </Link>
            </Button>
          )}

          {pages.map((page, i) =>
            page === "..." ? (
              <span key={`dots-${i}`} className="flex h-8 w-8 items-center justify-center text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <MoreHorizontal size={14} />
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 text-xs"
                style={page === currentPage ? { background: "var(--pf-accent)" } : undefined}
                asChild
              >
                <Link href={`${uri}?page=${page}`}>{page}</Link>
              </Button>
            )
          )}

          {currentPage < totalPages && (
            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
              <Link href={`${uri}?page=${currentPage + 1}`}>
                <ChevronRight size={14} />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
