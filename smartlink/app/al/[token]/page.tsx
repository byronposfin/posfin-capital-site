import { FormPage } from "@/components/FormPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Assets & Liabilities · SmartLink" };
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  return <FormPage form="al" token={token} sp={await searchParams} />;
}
