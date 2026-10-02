import {
  Beef,
  Beer,
  Cake,
  Coffee,
  CupSoda,
  Drumstick,
  Fish,
  Hamburger,
  IceCreamCone,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONES_POR_PALAVRA: [RegExp, LucideIcon][] = [
  [/hamb[uú]rguer|burger/, Hamburger],
  [/lanche|sandu[ií]che|sandwich/, Sandwich],
  [/pizza/, Pizza],
  [/cerveja|chopp?/, Beer],
  [/vinho/, Wine],
  [/caf[eé]/, Coffee],
  [/bebida|refri|suco|drink/, CupSoda],
  [/sobremesa|sorvete|doce|a[cç]a[ií]/, IceCreamCone],
  [/bolo|torta/, Cake],
  [/salada/, Salad],
  [/sopa|caldo/, Soup],
  [/peixe|frutos do mar/, Fish],
  [/carne|churrasco|grelhad/, Beef],
  [/frango/, Drumstick],
  [/por[cç][aã]o|petisco|entrada/, Utensils],
];

/** Ícone ilustrativo pelo nome da categoria; sem correspondência, usa talheres. */
export function iconeDaCategoria(nome: string): LucideIcon {
  const normalizado = nome.toLowerCase();
  return ICONES_POR_PALAVRA.find(([padrao]) => padrao.test(normalizado))?.[1] ?? UtensilsCrossed;
}
