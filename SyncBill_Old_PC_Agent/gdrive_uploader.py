"""
gdrive_uploader.py — Google Drive Automated API Uploader for SyncBill
===================================================================
PURPOSE:
1. Handles 1-time Google OAuth authorization (saves permanent token.json).
2. Creates and manages the cloud folder hierarchy:
   - SyncBill_Shop_Official/
     ├── Customer_Ledgers/
     ├── Vendor_Ledgers/
     ├── Invoices_And_Bills/
     └── System_Sync/
3. Uploads official Accurate .rpt PDFs and makes them shareable for WhatsApp.
4. Uploads sync_changes.json to System_Sync/ so the Laptop can pull all updates after hours.
"""

import os
import sys
import json
import mimetypes
from typing import Dict, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
CACHE_FILE = os.path.join(BASE_DIR, "uploaded_files_cache.json")

# Google Drive API Scopes
SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def get_drive_service():
    """
    Returns an authorized Google Drive v3 service instance.
    If token.json is expired or missing, it triggers local browser OAuth.
    """
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        print("[!] Google client libraries not installed. Run 1_INSTALL_REQUIREMENTS.bat!")
        return None

    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except Exception:
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None

        if not creds:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"[!] Warning: credentials.json not found at {CREDENTIALS_FILE}")
                return None
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save credentials for future silent runs
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


class GoogleDriveRelay:
    def __init__(self):
        self.service = get_drive_service()
        self.folder_cache = {}
        self.file_cache = self._load_cache()

    def _load_cache(self) -> dict:
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_cache(self):
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.file_cache, f, indent=2)
        except Exception:
            pass

    def get_or_create_folder(self, folder_name: str, parent_id: Optional[str] = None) -> Optional[str]:
        """Finds or creates a folder in Google Drive by name under parent_id."""
        if not self.service:
            return None

        cache_key = f"{parent_id}_{folder_name}"
        if cache_key in self.folder_cache:
            return self.folder_cache[cache_key]

        query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        try:
            results = self.service.files().list(q=query, fields="files(id, name)", spaces="drive").execute()
            files = results.get("files", [])
            if files:
                folder_id = files[0]["id"]
            else:
                meta = {
                    "name": folder_name,
                    "mimeType": "application/vnd.google-apps.folder",
                }
                if parent_id:
                    meta["parents"] = [parent_id]
                folder = self.service.files().create(body=meta, fields="id").execute()
                folder_id = folder.get("id")

            self.folder_cache[cache_key] = folder_id
            return folder_id
        except Exception as e:
            print(f"[!] Error creating/getting folder {folder_name}: {e}")
            return None

    def upload_file(self, local_path: str, folder_id: str, make_public: bool = True) -> Optional[Dict]:
        """
        Uploads or updates a file in Google Drive.
        Returns dict with {id, webViewLink, webContentLink}.
        """
        if not self.service or not os.path.exists(local_path):
            return None

        from googleapiclient.http import MediaFileUpload

        filename = os.path.basename(local_path)
        mtime = os.path.getmtime(local_path)

        # Check cache: if uploaded and mtime unchanged, skip
        cached = self.file_cache.get(local_path)
        if cached and cached.get("mtime") == mtime and cached.get("drive_id"):
            return cached

        mime_type, _ = mimetypes.guess_type(local_path)
        if not mime_type:
            mime_type = "application/pdf" if local_path.endswith(".pdf") else "application/octet-stream"

        media = MediaFileUpload(local_path, mimetype=mime_type, resumable=True)

        try:
            # Check if file already exists in folder
            q = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
            res = self.service.files().list(q=q, fields="files(id, name)", spaces="drive").execute()
            existing = res.get("files", [])

            if existing:
                file_id = existing[0]["id"]
                updated = self.service.files().update(fileId=file_id, media_body=media, fields="id, webViewLink, webContentLink").execute()
                res_dict = updated
            else:
                body = {"name": filename, "parents": [folder_id]}
                created = self.service.files().create(body=body, media_body=media, fields="id, webViewLink, webContentLink").execute()
                file_id = created.get("id")
                res_dict = created

            if make_public and file_id:
                try:
                    self.service.permissions().create(
                        fileId=file_id,
                        body={"type": "anyone", "role": "reader"},
                        fields="id"
                    ).execute()
                except Exception:
                    pass

            result = {
                "drive_id": file_id,
                "view_url": res_dict.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view",
                "download_url": res_dict.get("webContentLink") or f"https://drive.google.com/uc?id={file_id}&export=download",
                "filename": filename,
                "mtime": mtime,
            }
            self.file_cache[local_path] = result
            self._save_cache()
            return result
        except Exception as e:
            print(f"[!] Upload failed for {filename}: {e}")
            return None

    def upload_sync_changes(self, sync_payload: dict, system_sync_folder_id: str) -> bool:
        """Uploads sync_changes.json to Google Drive for the Laptop to consume after hours."""
        temp_path = os.path.join(BASE_DIR, "sync_changes.json")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(sync_payload, f, indent=2)
            self.upload_file(temp_path, system_sync_folder_id, make_public=False)
            return True
        except Exception as e:
            print(f"[!] Failed to upload sync_changes.json: {e}")
            return False

