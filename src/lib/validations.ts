import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  name: z.string().min(1, "请输入姓名").max(100),
  password: z.string().min(6, "密码至少6个字符").max(100),
});

export const renameDocumentSchema = z.object({
  name: z.string().min(1, "文档名称不能为空").max(255),
});
