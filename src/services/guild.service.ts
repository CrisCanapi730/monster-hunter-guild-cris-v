import { GuildCreateDto, GuildUpdateDto, GuildResponseDto } from "../dto/guild.dto";
import { Guild } from "../generated/prisma/client";
import { IGuildRepository } from "../repositories/guild.interface";

export class GuildService{
    constructor(private repository: IGuildRepository){}

    responseDto(guild: Guild): GuildResponseDto{
        return {
            id: guild.id,
            name: guild.name,
            region: guild.region,
            headquarters: guild.headquarters
        }
    }
    async create(data: GuildCreateDto): Promise<GuildResponseDto>{
        const guild = await this.repository.create(data)
        return this.responseDto(guild);
    }
    async update(id: string, data: GuildUpdateDto): Promise<GuildResponseDto>{
        const guild = await this.repository.update(id, data)
        return this.responseDto(guild);
    }
    async delete(id: string): Promise<void>{
        const guild = await this.repository.delete(id)
    }
    async getAll(): Promise<GuildResponseDto[]>{
        const guilds = await this.repository.getAll();
        return guilds.map((guild) => this.responseDto(guild));
    }
    async getById(id: string): Promise<GuildResponseDto>{
        const guild = await this.repository.getById(id)
        if(!guild){
            throw new Error("Guild not found");
        }
        return this.responseDto(guild);
    }
}