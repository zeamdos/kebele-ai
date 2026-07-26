import copy from "@/lib/copy/am.json";

export type AmCopy = typeof copy;

export function amCopy(): AmCopy {
  return copy;
}
