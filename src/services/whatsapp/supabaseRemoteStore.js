
import fs from "fs/promises";
import path from "path";

export class SupabaseRemoteStore {
  constructor({
    supabase,
    bucket,
    dataPath,
  }) {
    if (!supabase) {
      throw new Error(
        "Supabase client is required for SupabaseRemoteStore"
      );
    }

    if (!bucket) {
      throw new Error(
        "Supabase Storage bucket is required"
      );
    }

    if (!dataPath) {
      throw new Error(
        "RemoteAuth dataPath is required"
      );
    }

    this.supabase = supabase;
    this.bucket = bucket;
    this.dataPath = path.resolve(dataPath);
  }

  getArchivePath(session) {
    return path.join(
      this.dataPath,
      `${session}.zip`
    );
  }

  getStoragePath(session) {
    return `${session}/${session}.zip`;
  }

  async sessionExists({ session }) {
    const storagePath =
      this.getStoragePath(session);

    const directory = session;
    const filename = `${session}.zip`;

    const {
      data,
      error,
    } = await this.supabase.storage
      .from(this.bucket)
      .list(directory, {
        limit: 1,
        search: filename,
      });

    if (error) {
      throw new Error(
        `Supabase sessionExists failed: ${error.message}`
      );
    }

    return Boolean(
      data?.some(
        (file) => file.name === filename
      )
    );
  }

  async save({ session }) {
    const archivePath =
      this.getArchivePath(session);

    try {
      await fs.access(archivePath);
    } catch {
      throw new Error(
        `RemoteAuth archive does not exist: ${archivePath}`
      );
    }

    const fileBuffer =
      await fs.readFile(archivePath);

    const storagePath =
      this.getStoragePath(session);

    const {
      error,
    } = await this.supabase.storage
      .from(this.bucket)
      .upload(
        storagePath,
        fileBuffer,
        {
          contentType:
            "application/zip",

          upsert: true,

          cacheControl:
            "3600",
        }
      );

    if (error) {
      throw new Error(
        `Supabase session upload failed: ${error.message}`
      );
    }

    console.log(
      `[RemoteAuth] Session uploaded: ${session}`
    );
  }

  async extract({
    session,
    path: destinationPath,
  }) {
    const storagePath =
      this.getStoragePath(session);

    const {
      data,
      error,
    } = await this.supabase.storage
      .from(this.bucket)
      .download(storagePath);

    if (error) {
      throw new Error(
        `Supabase session download failed: ${error.message}`
      );
    }

    if (!data) {
      throw new Error(
        `Supabase returned no session data for ${session}`
      );
    }

    const arrayBuffer =
      await data.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    await fs.mkdir(
      path.dirname(destinationPath),
      {
        recursive: true,
      }
    );

    await fs.writeFile(
      destinationPath,
      buffer
    );

    console.log(
      `[RemoteAuth] Session downloaded: ${session}`
    );
  }

  async delete({ session }) {
    const storagePath =
      this.getStoragePath(session);

    const {
      error,
    } = await this.supabase.storage
      .from(this.bucket)
      .remove([
        storagePath,
      ]);

    if (error) {
      throw new Error(
        `Supabase session deletion failed: ${error.message}`
      );
    }

    console.log(
      `[RemoteAuth] Session deleted: ${session}`
    );
  }
}
