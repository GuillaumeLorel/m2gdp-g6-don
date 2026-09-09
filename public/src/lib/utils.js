import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fusionne des classes Tailwind en resolvant les conflits. Utilitaire attendu
 *  par les composants shadcn/ui. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
