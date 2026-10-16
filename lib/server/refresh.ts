// 資料變動（匯入、後台編輯）後讓網站更新：清掉伺服器記憶體快取，並讓所有頁面重新產生。
// 頁面平時是靜態的；資料只會在這兩種情況改變，所以不需要定時重新產生。
import { revalidatePath } from 'next/cache';
import { invalidateData } from './dataset.ts';

export function refreshSite() {
  invalidateData();
  revalidatePath('/', 'layout');
}
