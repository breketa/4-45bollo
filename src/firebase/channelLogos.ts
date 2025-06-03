import { db, storage } from "./config";
import { collection, addDoc, getDoc, query, where, getDocs, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * ინტერფეისი YouTube არხის ლოგოს მონაცემებისთვის
 */
export interface ChannelLogo {
  id?: string;
  channelId: string;
  channelName: string;
  logoUrl: string;
  // არხის პლატფორმა (მომავალი გაფართოებისთვის)
  platform: 'YouTube' | 'Twitch' | 'TikTok' | 'Instagram' | 'Other';
  // შენახვის თარიღი
  createdAt: number;
}

/**
 * შეინახავს YouTube არხის ლოგოს Firestore-ში
 * @param channelId YouTube არხის უნიკალური იდენტიფიკატორი
 * @param channelName არხის სახელი
 * @param logoUrl ლოგოს URL მისამართი
 * @returns შენახული დოკუმენტის ID
 */
export async function saveChannelLogo(
  channelId: string,
  channelName: string,
  logoUrl: string,
  platform: 'YouTube' | 'Twitch' | 'TikTok' | 'Instagram' | 'Other' = 'YouTube'
): Promise<string> {
  try {
    // თავდაპირველად შევამოწმოთ ხომ არ არსებობს უკვე ეს არხი ბაზაში
    const existingLogoRef = query(
      collection(db, "channelLogos"),
      where("channelId", "==", channelId)
    );

    const snapshot = await getDocs(existingLogoRef);
    
    // თუ უკვე არსებობს, დავაბრუნოთ არსებული დოკუმენტის ID
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // შევქმნათ ახალი ჩანაწერი Firestore-ში
    const logoData: ChannelLogo = {
      channelId,
      channelName,
      logoUrl,
      platform,
      createdAt: Date.now()
    };

    const docRef = await addDoc(collection(db, "channelLogos"), logoData);
    return docRef.id;
  } catch (error) {
    console.error("Error saving channel logo:", error);
    throw error;
  }
}

/**
 * იღებს არხის ლოგოს მონაცემებს Firestore-იდან
 * @param channelId YouTube არხის უნიკალური იდენტიფიკატორი
 * @returns არხის ლოგოს ინფორმაცია ან null
 */
export async function getChannelLogo(channelId: string): Promise<ChannelLogo | null> {
  try {
    const logoQuery = query(
      collection(db, "channelLogos"),
      where("channelId", "==", channelId)
    );

    const snapshot = await getDocs(logoQuery);
    
    if (snapshot.empty) {
      return null;
    }

    const logoDoc = snapshot.docs[0];
    return {
      id: logoDoc.id,
      ...logoDoc.data()
    } as ChannelLogo;
  } catch (error) {
    console.error("Error getting channel logo:", error);
    throw error;
  }
}

/**
 * იღებს არხის ლოგოს URL-ს channelId-ის მიხედვით
 * @param channelId YouTube არხის უნიკალური იდენტიფიკატორი
 * @returns ლოგოს URL ან null
 */
export async function getChannelLogoUrl(channelId: string): Promise<string | null> {
  try {
    const logo = await getChannelLogo(channelId);
    return logo ? logo.logoUrl : null;
  } catch (error) {
    console.error("Error getting channel logo URL:", error);
    return null;
  }
}

/**
 * ამოიღებს არხის ID-ს YouTube URL-დან
 * @param url YouTube არხის URL
 * @returns არხის ID ან null
 */
export function extractChannelIdFromUrl(url: string): string | null {
  try {
    console.log("Extracting channel ID from URL:", url);
    
    // არხის ლინკის ნორმალიზება
    let normalizedLink = url.trim().toLowerCase();
    normalizedLink = normalizedLink.replace(/^(https?:\/\/)?(www\.)?/, "");
    normalizedLink = normalizedLink.replace(/\/$/, "");
    
    console.log("Normalized link:", normalizedLink);
    
    // განვასხვავოთ youtube არხის ფორმატები
    const patterns = [
      /youtube\.com\/channel\/([^\/\?]+)/,  // channel ID format
      /youtube\.com\/@([^\/\?]+)/,          // @username format
      /youtube\.com\/c\/([^\/\?]+)/,        // custom URL format
      /youtube\.com\/user\/([^\/\?]+)/      // legacy username format
    ];
    
    for (const pattern of patterns) {
      const match = normalizedLink.match(pattern);
      if (match && match[1]) {
        const identifier = match[1];
        console.log("Found identifier:", identifier, "using pattern:", pattern);
        
        // If it's a @username format, keep the @ symbol
        if (pattern.toString().includes('@')) {
          return '@' + identifier;
    }
        return identifier;
      }
    }
    
    console.log("No matching pattern found");
    return null;
  } catch (e) {
    console.error("Error extracting channel ID:", e);
    return null;
  }
}

/**
 * ფუნქცია, რომელიც გადმოიწერს ლოგოს URL-დან და შეინახავს Firebase Storage-ში
 * @param logoUrl ლოგოს URL
 * @param userId მომხმარებლის ID
 * @param channelId არხის ID
 * @returns შენახული ფაილის URL
 */
export async function downloadAndStoreChannelLogo(
  logoUrl: string,
  userId: string,
  channelId: string
): Promise<string> {
  try {
    console.log("Starting logo download process...");
    
    // Add a small delay before making the request
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // URL-დან გამოვითხოვოთ ლოგოს გამოსახულება
    const response = await fetch(logoUrl);
    
    if (!response.ok) {
      console.error("Failed to fetch logo:", response.status, response.statusText);
      return logoUrl;
    }
    
    const blob = await response.blob();
    console.log("Logo blob size:", blob.size);
    
    // შევქმნათ უნიკალური სახელი ფაილისთვის
    const fileExtension = logoUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${channelId}_${Date.now()}.${fileExtension}`;
    const storagePath = `channelLogos/${userId}/${fileName}`;
    
    console.log("Uploading to storage path:", storagePath);
    
    // ავტვირთოთ Firebase Storage-ში
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    
    console.log("Upload completed successfully");
    
    // დავაბრუნოთ ატვირთული ფაილის URL
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("Generated download URL:", downloadUrl);
    
    return downloadUrl;
  } catch (error) {
    console.error("Error downloading and storing channel logo:", error);
    // თუ შეცდომაა, დავაბრუნოთ ორიგინალი URL
    return logoUrl;
  }
}

/**
 * გამოითხოვს ფაილს პირდაპირ Firebase Storage-დან კონკრეტული მისამართის გამოყენებით
 * @param storagePath Firebase Storage-ში ფაილის სრული მისამართი
 * @returns ფაილის იუარელი ან null
 */
export async function getStorageFileUrl(storagePath: string): Promise<string | null> {
  try {
    // შევქმნათ სტორიჯის რეფერენსი მითითებული მისამართით
    const storageRef = ref(storage, storagePath);
    
    // გამოვითხოვოთ ფაილის ჩამოტვირთვის URL
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    console.error("Error getting file from storage:", error);
    return null;
  }
} 