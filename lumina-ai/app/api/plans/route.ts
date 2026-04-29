import { backendJson, nextJsonFromBackend } from "@/app/api/_shared/backend";

export async function GET() {
  try {
    const { response, data } = await backendJson("/api/plans");
    return nextJsonFromBackend(response.status, data);
  } catch (error) {
    console.error("获取套餐失败:", error);
    return nextJsonFromBackend(500, { detail: "获取套餐失败" });
  }
}
