import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast, MoreHorizontal } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Button } from "./Button";
import { ChoiceSelect } from "./ChoiceSelect";

function PaginationRoot({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<"button">;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <button
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-xs font-medium transition",
        isActive
          ? "border border-ink/15 bg-subtle text-ink shadow-sm"
          : "text-ink/55 hover:bg-subtle hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("size-8 px-0", className)} {...props}>
      <ChevronLeft size={16} />
    </Button>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("size-8 px-0", className)} {...props}>
      <ChevronRight size={16} />
    </Button>
  );
}

function PaginationFirst({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("size-8 px-0", className)} {...props}>
      <ChevronFirst size={16} />
    </Button>
  );
}

function PaginationLast({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("size-8 px-0", className)} {...props}>
      <ChevronLast size={16} />
    </Button>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 items-center justify-center text-ink/35 text-xs", className)}
      {...props}
    >
      <MoreHorizontal size={14} />
    </span>
  );
}

function pageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export type PaginationProps = {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 0) return null;

  const nums = pageNumbers(currentPage, totalPages);

  const PAGE_SIZE_OPTIONS = [
    { value: "10", label: t("pagination.itemPerPage", { size: 10 }) },
    { value: "30", label: t("pagination.itemPerPage", { size: 30 }) },
    { value: "100", label: t("pagination.itemPerPage", { size: 100 }) },
  ];

  return (
    <div className="flex items-center justify-between gap-4 pt-3 border-t border-ink/10">
      <div className="w-32 shrink-0">
        <ChoiceSelect
          value={String(pageSize)}
          options={PAGE_SIZE_OPTIONS}
          onChange={(value) => onPageSizeChange(Number(value))}
        />
      </div>

      <PaginationRoot>
        <PaginationContent>
          <PaginationItem>
            <PaginationFirst
              disabled={currentPage <= 1}
              onClick={() => onPageChange(1)}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            />
          </PaginationItem>

          {nums.map((item, i) => (
            <PaginationItem key={item === "ellipsis" ? `e${i}` : item}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  isActive={item === currentPage}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLast
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>

      <div className="text-xs text-ink/45 whitespace-nowrap">
        {t("pagination.total", { count: totalCount })}
      </div>
    </div>
  );
}
