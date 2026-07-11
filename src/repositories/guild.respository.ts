import { PrismaClient, Guild } from "../generated/prisma/client";
import { IGuildRepository } from "./guild.interface";
import { GuildCreateDto, GuildUpdateDto } from "../dto/guild.dto";

export class GuildRepository implements IGuildRepository{

    constructor(private prisma: PrismaClient){}

    create(data: GuildCreateDto): Promise<Guild>{
        return this.prisma.guild.create({data});
    }

    update(id: string, data: GuildUpdateDto): Promise<Guild>{
        return this.prisma.guild.update({ where: {id}, data});
    }
    delete(id: string): Promise<Guild>{
        return this.prisma.guild.delete({where: {id}});
    }
    findAll(): Promise<Guild[]>{
        return this.prisma.guild.findMany();
    }
    findById(id: string): Promise<Guild | null>{
        return this.prisma.guild.findUnique({where: {id}});
    }
}