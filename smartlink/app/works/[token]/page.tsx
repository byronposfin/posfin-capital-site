import { FormPage } from "@/components/FormPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule of Works · SmartLink" };
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  return <FormPage form="works" token={token} sp={await searchParams} />;
}
