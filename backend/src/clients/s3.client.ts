import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function createS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  // forcePathStyle required for MiniStack and LocalStack-compatible endpoints
  return new S3Client(
    endpoint ? { endpoint, region, forcePathStyle: true } : { region },
  );
}

export async function generatePresignedPutUrl(
  s3: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, command, { expiresIn });
}
