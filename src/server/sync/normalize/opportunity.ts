import type { Prisma, OpportunityStatus } from "@prisma/client";

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId?: string | null;
  pipelineStageId?: string | null;
  monetaryValue?: number | null;
  status?: string | null; // "open" | "won" | "lost" | "abandoned"
  source?: string | null;
  assignedTo?: string | null;
  contactId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pipelineName?: string | null;
  stageName?: string | null;
}

function mapStatus(status: string | null | undefined): OpportunityStatus {
  switch ((status ?? "").toLowerCase()) {
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    case "abandoned":
      return "ABANDONED";
    default:
      return "OPEN";
  }
}

export function normalizeOpportunity(
  raw: GhlOpportunity,
  agencyId: string,
  locationId: string,
  internalContactId: string | null,
): Prisma.OpportunityUpsertArgs {
  const data = {
    agencyId,
    locationId,
    contactId: internalContactId,
    ghlOpportunityId: raw.id,
    name: raw.name,
    pipelineId: raw.pipelineId ?? null,
    pipelineName: raw.pipelineName ?? null,
    stageId: raw.pipelineStageId ?? null,
    stageName: raw.stageName ?? null,
    monetaryValue: raw.monetaryValue ?? 0,
    status: mapStatus(raw.status),
    source: raw.source ?? null,
    assignedGhlUserId: raw.assignedTo ?? null,
    createdAtGhl: raw.createdAt ? new Date(raw.createdAt) : null,
    updatedAtGhl: raw.updatedAt ? new Date(raw.updatedAt) : null,
    raw: raw as unknown as Prisma.InputJsonValue,
  };

  return {
    where: { locationId_ghlOpportunityId: { locationId, ghlOpportunityId: raw.id } },
    create: data,
    update: data,
  };
}
