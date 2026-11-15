import { siCodeforces, siGithub, siLeetcode, siX } from "simple-icons";
import { emailIcon, linkedinIcon } from "@/content/fallback-icons";

declare const SocialLinkBrand: unique symbol;
declare const HexBrand: unique symbol;
declare const IconBrand: unique symbol;

export type LinkHref =
  | { readonly kind: "web"; readonly url: string }
  | { readonly kind: "mail"; readonly url: string };

export type HexColor = string & { readonly [HexBrand]: true };
export type IconPath = string & { readonly [IconBrand]: true };

export type IconSource = {
  readonly path: string;
  readonly hex: string;
};

export type LinkDraft = {
  readonly label: string;
  readonly href: string;
  readonly icon: IconSource;
};

export type SocialLink = {
  readonly [SocialLinkBrand]: true;
  readonly id: string;
  readonly label: string;
  readonly href: LinkHref;
  readonly iconPath: IconPath;
  readonly color: HexColor;
};

export type ParsedLinks<Id extends string> = {
  readonly byId: { readonly [K in Id]: SocialLink & { readonly id: K } };
  readonly list: readonly (SocialLink & { readonly id: Id })[];
};

const HEX = /^[0-9a-fA-F]{6}$/;

function parseHref(raw: string): LinkHref {
  const url = new URL(raw);
  if (url.protocol === "https:") return { kind: "web", url: url.href };
  if (url.protocol === "mailto:") return { kind: "mail", url: url.href };
  throw new Error(`Href must be https or mailto: ${raw}`);
}

function parseHex(hex: string): HexColor {
  if (!HEX.test(hex)) throw new Error(`Icon hex must be 6 digits: ${hex}`);
  return `#${hex}` as HexColor;
}

function parseIconPath(path: string): IconPath {
  if (path.length === 0) throw new Error("Icon path is empty");
  return path as IconPath;
}

export function parseSocialLinks<const Defs extends Record<string, LinkDraft>>(
  defs: Defs,
): ParsedLinks<keyof Defs & string> {
  const byId: Record<string, SocialLink> = {};
  const list: SocialLink[] = [];

  for (const id of Object.keys(defs)) {
    const draft = defs[id];
    if (draft.label.trim().length === 0) throw new Error(`Empty label for ${id}`);
    const link = {
      id,
      label: draft.label,
      href: parseHref(draft.href),
      iconPath: parseIconPath(draft.icon.path),
      color: parseHex(draft.icon.hex),
    } as SocialLink;
    byId[id] = link;
    list.push(link);
  }

  return {
    byId: byId as ParsedLinks<keyof Defs & string>["byId"],
    list: list as ParsedLinks<keyof Defs & string>["list"],
  };
}

export function linkKey(links: readonly SocialLink[]): string {
  return links.map((link) => `${link.id}\u0000${link.href.kind}\u0000${link.href.url}`).join("\n");
}

export const SOCIAL_LINK_DEFS = {
  github: { label: "GitHub", href: "https://github.com/kapillohani023", icon: siGithub },
  linkedin: { label: "LinkedIn", href: "https://linkedin.com/in/kapillohani023", icon: linkedinIcon },
  x: { label: "X", href: "https://x.com/i2kapill", icon: siX },
  leetcode: { label: "LeetCode", href: "https://leetcode.com/u/kapillohani023/", icon: siLeetcode },
  codeforces: {
    label: "Codeforces",
    href: "https://codeforces.com/profile/kapillohani023",
    icon: siCodeforces,
  },
  email: { label: "Email", href: "mailto:kapillohani023@gmail.com", icon: emailIcon },
} as const satisfies Record<string, LinkDraft>;

const parsed = parseSocialLinks(SOCIAL_LINK_DEFS);
export const socialLinksById = parsed.byId;
export const socialLinks = parsed.list;
