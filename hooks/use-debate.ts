import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import { useCallback, useState } from 'react';

export type DebateUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

export type DebateSegment = {
  id: string;
  debate_id: string;
  post_id: string | null;
  speaker_id: string;
  text: string | null;
  file: string | null;
  side: 'root' | 'challenger';
  round_number: number;
  created_at: string;
  speaker?: DebateUser;
};

export type DebateRecord = {
  id: string;
  root_post_id: string | null;
  root_comment_id: string | null;
  challenger_id: string;
  opponent_id: string | null;
  status?: string | null;
  created_at?: string;
  challenger_text?: string | null;
  challenger_file?: string | null;
  challenger?: DebateUser;
  opponent?: DebateUser | null;
};

export type InlineDebateSegment = DebateSegment & {
  speaker?: DebateUser;
};

export type InlineCommentDebate = DebateRecord & {
  root_comment_id: string;
  segments: InlineDebateSegment[];
};

export type DebateTargetComment = {
  id: string;
  post_id: string;
  speaker_id: string;
  text: string | null;
  file: string | null;
  created_at: string;
  parent_comment_id?: string | null;
  reply_to_comment_id?: string | null;
  is_debatable: boolean;
  speaker?: DebateUser;
};

export const useDebate = () => {
  const [debate, setDebate] = useState<DebateRecord | null>(null);
  const [targetComment, setTargetComment] = useState<DebateTargetComment | null>(null);
  const [segments, setSegments] = useState<DebateSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (postId?: string, debateId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)');

      if (debateId) {
        query = query.eq('id', debateId);
      } else if (postId) {
        query = query.eq('root_post_id', postId);
      }

      const { data: debateData, error: debateError } = await query.maybeSingle();
      if (debateError) throw debateError;

      const debateRecord = (debateData as unknown as DebateRecord | null) ?? null;
      setDebate(debateRecord);

      let targetCommentRecord: DebateTargetComment | null = null;
      if (debateRecord?.root_comment_id) {
        const { data, error: targetError } = await supabase
          .from('Comment')
          .select('*, speaker:User!speaker_id(id,username,avatar)')
          .eq('id', debateRecord.root_comment_id)
          .maybeSingle();
        if (targetError) throw targetError;
        targetCommentRecord = (data as unknown as DebateTargetComment | null) ?? null;
      }
      setTargetComment(targetCommentRecord);

      let debateSegments: DebateSegment[] = [];
      if (debateRecord?.id) {
        const { data, error: segmentsError } = await supabase
          .from('DebateSegment')
          .select('*, speaker:User!speaker_id(id,username,avatar)')
          .eq('debate_id', debateRecord.id)
          .order('round_number', { ascending: true });
        if (segmentsError) throw segmentsError;
        debateSegments = (data ?? []) as unknown as DebateSegment[];
      }
      setSegments(debateSegments);

      return {
        debate: debateRecord,
        targetComment: targetCommentRecord,
        segments: debateSegments,
      };
    } catch (cause) {
      const loadError = cause instanceof Error ? cause : new Error(String(cause));
      setError(loadError);
      console.error('Error loading debate:', loadError);
      return { debate: null, targetComment: null, segments: [] };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitSegment = useCallback(async (input: {
    debateId: string;
    postId: string;
    speakerId: string;
    text: string;
    file: string | null;
    side: 'root' | 'challenger';
    roundNumber: number;
  }) => {
    const { data, error: segmentError } = await supabase
      .from('DebateSegment')
      .insert({
        id: Crypto.randomUUID(),
        debate_id: input.debateId,
        post_id: input.postId,
        speaker_id: input.speakerId,
        text: input.text,
        file: input.file,
        side: input.side,
        round_number: input.roundNumber,
      })
      .select('*, speaker:User!speaker_id(id,username,avatar)')
      .single();

    if (segmentError) throw segmentError;

    const segment = data as unknown as DebateSegment;
    setSegments((current) => [...current, segment].sort(
      (a, b) => a.round_number - b.round_number || a.created_at.localeCompare(b.created_at)
    ));
    return segment;
  }, []);

  return {
    debate,
    targetComment,
    segments,
    isLoading,
    error,
    load,
    submitSegment,
  };
};

export const useCommentDebates = (commentIds: string[]) => {
  const [commentDebates, setCommentDebates] = useState<Record<string, InlineCommentDebate>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const commentIdsKey = commentIds.join(',');

  const load = useCallback(async () => {
    const ids = commentIdsKey ? commentIdsKey.split(',') : [];
    if (!ids.length) {
      setCommentDebates({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data: debates, error: debatesError } = await supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(id,username,avatar), opponent:User!opponent_id(id,username,avatar)')
        .in('root_comment_id', ids);
      if (debatesError) throw debatesError;

      const debateIds = (debates ?? []).map((item) => item.id);
      let segments: InlineDebateSegment[] = [];
      if (debateIds.length) {
        const { data, error: segmentsError } = await supabase
          .from('DebateSegment')
          .select('*, speaker:User!speaker_id(id,username,avatar)')
          .in('debate_id', debateIds)
          .order('round_number', { ascending: true });
        if (segmentsError) throw segmentsError;
        segments = (data ?? []) as unknown as InlineDebateSegment[];
      }

      const segmentsByDebate = new Map<string, InlineDebateSegment[]>();
      segments.forEach((segment) => {
        const existing = segmentsByDebate.get(segment.debate_id) ?? [];
        existing.push(segment);
        segmentsByDebate.set(segment.debate_id, existing);
      });

      const nextDebates: Record<string, InlineCommentDebate> = {};
      (debates ?? []).forEach((item) => {
        if (!item.root_comment_id) return;
        nextDebates[item.root_comment_id] = {
          ...(item as unknown as InlineCommentDebate),
          segments: segmentsByDebate.get(item.id) ?? [],
        };
      });
      setCommentDebates(nextDebates);
    } catch (cause) {
      const loadError = cause instanceof Error ? cause : new Error(String(cause));
      setError(loadError);
      console.error('Error loading comment debates:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, [commentIdsKey]);

  const create = useCallback(async (input: {
    postId: string;
    targetComment: DebateTargetComment;
    challengerId: string;
    text: string;
    mediaFilename: string | null;
  }) => {
    if (input.targetComment.speaker_id === input.challengerId) {
      throw new Error('You cannot debate your own comment.');
    }

    const debateId = Crypto.randomUUID();
    const { error: debateError } = await supabase.from('Debate').insert({
      id: debateId,
      root_post_id: null,
      root_comment_id: input.targetComment.id,
      challenger_id: input.challengerId,
      opponent_id: input.targetComment.speaker_id,
      challenger_text: input.text,
      status: 'open',
    });
    if (debateError) throw debateError;

    const { data: segmentData, error: segmentError } = await supabase
      .from('DebateSegment')
      .insert({
        id: Crypto.randomUUID(),
        debate_id: debateId,
        post_id: input.postId,
        speaker_id: input.challengerId,
        text: input.text,
        file: input.mediaFilename,
        side: 'challenger',
        round_number: 2,
      })
      .select('*, speaker:User!speaker_id(id,username,avatar)')
      .single();

    if (segmentError) {
      await supabase.from('Debate').delete().eq('id', debateId);
      throw segmentError;
    }

    const { error: commentUpdateError } = await supabase
      .from('Comment')
      .update({ is_debatable: true })
      .eq('id', input.targetComment.id);
    if (commentUpdateError) {
      console.error('Error marking debate target comment as debatable:', commentUpdateError);
    }

    const segment = segmentData as unknown as InlineDebateSegment;
    const created: InlineCommentDebate = {
      id: debateId,
      root_post_id: null,
      root_comment_id: input.targetComment.id,
      challenger_id: input.challengerId,
      opponent_id: input.targetComment.speaker_id,
      challenger: segment.speaker,
      opponent: input.targetComment.speaker ?? null,
      segments: [segment],
    };
    setCommentDebates((current) => ({
      ...current,
      [input.targetComment.id]: created,
    }));
    return created;
  }, []);

  const submitResponse = useCallback(async (input: {
    debate: InlineCommentDebate;
    postId: string;
    currentUserId: string;
    text: string;
    mediaFilename: string | null;
  }) => {
    const lastSegment = input.debate.segments[input.debate.segments.length - 1];
    const nextSpeakerId = !lastSegment
      ? input.debate.challenger_id
      : lastSegment.side === 'challenger'
        ? input.debate.opponent_id
        : input.debate.challenger_id;

    if (input.currentUserId !== nextSpeakerId) {
      throw new Error('It is not your turn in this debate.');
    }

    const side = input.currentUserId === input.debate.challenger_id ? 'challenger' : 'root';
    const { data, error: segmentError } = await supabase
      .from('DebateSegment')
      .insert({
        id: Crypto.randomUUID(),
        debate_id: input.debate.id,
        post_id: input.postId,
        speaker_id: input.currentUserId,
        text: input.text,
        file: input.mediaFilename,
        side,
        round_number: input.debate.segments.length + 2,
      })
      .select('*, speaker:User!speaker_id(id,username,avatar)')
      .single();
    if (segmentError) throw segmentError;

    const segment = data as unknown as InlineDebateSegment;
    setCommentDebates((current) => ({
      ...current,
      [input.debate.root_comment_id]: {
        ...(current[input.debate.root_comment_id] ?? input.debate),
        segments: [
          ...(current[input.debate.root_comment_id]?.segments ?? input.debate.segments),
          segment,
        ],
      },
    }));
    return segment;
  }, []);

  return {
    commentDebates,
    isLoading,
    error,
    load,
    create,
    submitResponse,
  };
};
