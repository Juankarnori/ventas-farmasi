import { Fragment } from "react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { variantLabel } from "@/lib/utils/variant-label";
import { LowStockBadge } from "./low-stock-badge";
import { AdjustStockDialog } from "./adjust-stock-dialog";

export interface StockGroup {
  productId: string;
  productName: string;
  category: { name: string } | null;
  variants: {
    id: string;
    colorName: string;
    stock: number;
    threshold: number;
  }[];
}

export function StockTable({ groups }: { groups: StockGroup[] }) {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Color</Th>
          <Th className="text-right">Stock</Th>
          <Th className="text-right">Mínimo</Th>
          <Th>Estado</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {groups.map((group) => (
          <Fragment key={group.productId}>
            <Tr className="hover:bg-transparent">
              <Td colSpan={5} className="bg-panel/30 font-semibold text-ink">
                {group.productName}
                {group.category && (
                  <span className="ml-2 font-normal text-ink/50">{group.category.name}</span>
                )}
              </Td>
            </Tr>
            {group.variants.map((v) => (
              <Tr key={v.id}>
                <Td className="pl-6">{v.colorName}</Td>
                <Td numeric>{v.stock}</Td>
                <Td numeric>{v.threshold}</Td>
                <Td>
                  <LowStockBadge stock={v.stock} threshold={v.threshold} />
                </Td>
                <Td>
                  <AdjustStockDialog
                    variantId={v.id}
                    label={variantLabel(group.productName, v.colorName)}
                  />
                </Td>
              </Tr>
            ))}
          </Fragment>
        ))}
      </Tbody>
    </Table>
  );
}
