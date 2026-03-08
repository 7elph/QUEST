import { NotificationType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function pushNotification(input: {
  userId: string;
  type?: NotificationType | `${NotificationType}`;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  sendEmailTo?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: (input.type as NotificationType | undefined) ?? NotificationType.SYSTEM,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
    },
  });

  if (input.sendEmailTo) {
    await sendEmail({
      to: input.sendEmailTo,
      subject: `[QUEST] ${input.title}`,
      text: input.message,
    });
  }
}

export async function markNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
