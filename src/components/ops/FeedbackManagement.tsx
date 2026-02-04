import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Star } from 'lucide-react';
import { format } from 'date-fns';

interface FeedbackRow {
  id: string;
  invoice_id: string;
  rating: number | null;
  comment: string | null;
  client_name: string | null;
  created_at: string;
  invoice_number: string | null;
  user_email: string | null;
}

export function FeedbackManagement() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      const { data, error } = await supabase.rpc('get_all_feedback');
      if (!error && data) {
        setFeedback(data as FeedbackRow[]);
      }
      setLoading(false);
    };
    fetchFeedback();
  }, []);

  const averageRating =
    feedback.filter((f) => f.rating !== null).reduce((acc, f) => acc + (f.rating || 0), 0) /
      (feedback.filter((f) => f.rating !== null).length || 1) || 0;

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground">No rating</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Feedback Management
        </CardTitle>
        <CardDescription>All customer feedback across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            {feedback.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                <span className="text-muted-foreground">Average Rating</span>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xl font-bold">{averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    ({feedback.filter((f) => f.rating !== null).length} ratings)
                  </span>
                </div>
              </div>
            )}

            {feedback.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No feedback yet</p>
            ) : (
              <div className="space-y-3">
                {feedback.map((fb) => (
                  <div key={fb.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{fb.client_name || 'Anonymous'}</span>
                          {fb.invoice_number && (
                            <Badge variant="outline">{fb.invoice_number}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{fb.user_email}</p>
                      </div>
                      {renderStars(fb.rating)}
                    </div>
                    {fb.comment && <p className="text-sm">{fb.comment}</p>}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(fb.created_at), 'PPp')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
