import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "storage-browser-test",
  access: (allow: any) => ({
    // public配下のすべてのパスへのアクセスを許可
    // これによりどんなフォルダでもアクセス可能になる
    'public/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
  }),
});
