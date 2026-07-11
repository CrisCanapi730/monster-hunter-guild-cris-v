import { Prisma, PrismaClient, Guild } from "../generated/prisma/client";
import { IGuildRepository } from "./guild.interface";
import { prisma } from "../config/prisma";


export class GuildRepository implements IGuildRepository{

    constructor(private prisma: PrismaClient){}

    create(data: Prisma.GuildCreateInput): Promise<Guild>{
        return this.prisma.guild.create({data});
    }

    update(id: string, data: Prisma.GuildUpdateInput): Promise<Guild>{
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