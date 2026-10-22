/**
 * draw.io 用の最小限の XML 組み立て・出力。
 *
 * draw.io はラベルの改行を属性値の改行で表すため、属性値の改行は &#10; にエスケープする
 * （エスケープしないと XML パーサーが空白に正規化してしまう）。
 * 出力形式（2 スペースインデント、空要素は `<tag ... />`）は従来の Python 版（ElementTree）に合わせている。
 */

export interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
}

export function element(tag: string, attrs: Record<string, string> = {}, children: XmlElement[] = []): XmlElement {
  return { tag, attrs, children };
}

const ATTR_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "\r": "&#13;",
  "\n": "&#10;",
  "\t": "&#09;",
};

function escapeAttr(value: string): string {
  return value.replace(/[&<>"\r\n\t]/g, (c) => ATTR_ESCAPES[c] ?? c);
}

function serialize(el: XmlElement, depth: number): string {
  const indent = "  ".repeat(depth);
  const attrs = Object.entries(el.attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join("");
  if (el.children.length === 0) {
    return `${indent}<${el.tag}${attrs} />\n`;
  }
  const children = el.children.map((child) => serialize(child, depth + 1)).join("");
  return `${indent}<${el.tag}${attrs}>\n${children}${indent}</${el.tag}>\n`;
}

/** XML 宣言なし・末尾改行ありの文字列にする。 */
export function toXmlString(root: XmlElement): string {
  return serialize(root, 0);
}
