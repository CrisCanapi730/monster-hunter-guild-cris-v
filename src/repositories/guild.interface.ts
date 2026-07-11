import { Guild } from "../generated/prisma/client";
import { GuildCreateDto, GuildUpdateDto } from "../dto/guild.dto";

export interface IGuildRepository{
    create(data: GuildCreateDto): Promise<Guild>;
    update(id: string, data: GuildUpdateDto): Promise<Guild>;
    delete(id: string): Promise<Guild>; 
    findAll(): Promise<Guild[]>;
    findById(id: string): Promise<Guild | null>;
}