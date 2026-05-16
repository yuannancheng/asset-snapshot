import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import type { PropsWithChildren, ReactNode } from "react";
import { Fragment } from "react";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
}>;

export function Modal({ open, title, description, footer, onClose, children }: ModalProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="translate-y-2 opacity-0"
              enterTo="translate-y-0 opacity-100"
              leave="ease-in duration-100"
              leaveFrom="translate-y-0 opacity-100"
              leaveTo="translate-y-2 opacity-0"
            >
              <DialogPanel className="w-full max-w-2xl rounded-lg border border-ink/10 bg-white shadow-panel">
                <div className="border-b border-ink/10 p-5">
                  <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>
                  {description ? <p className="mt-1 text-sm text-ink/55">{description}</p> : null}
                </div>
                <div className="p-5">{children}</div>
                {footer ? (
                  <div className="flex justify-end gap-3 border-t border-ink/10 p-5">{footer}</div>
                ) : null}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
