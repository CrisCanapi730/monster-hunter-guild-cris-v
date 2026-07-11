import { Guild } from "../generated/prisma/browser";
import { Prisma } from "../generated/prisma/client";

export interface IGuildRepository{
    create(data: Prisma.GuildCreateInput): Promise<Guild>;
    update(id: string, data: Prisma.GuildUpdateInput): Promise<Guild>;
    delete(id: string): Promise<Guild>; 
    findAll(): Promise<Guild[]>;
    findById(id: string): Promise<Guild | null>;
}