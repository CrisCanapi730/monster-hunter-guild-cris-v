export interface GuildCreateDto{
    name: string;
    region?: string;
    headquarters?: string;
}

export interface GuildUpdateDto{
    name?: string;
    region?: string;
    headquarters?: string;
}

export interface GuildResponseDto{
    id: string;
    name: string;
    region: string | null;
    headquarters: string | null;
}