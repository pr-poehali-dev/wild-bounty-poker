import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface PlayingCard {
  suit: Suit;
  rank: Rank;
  id: string;
}

interface GameHistory {
  id: string;
  bet: number;
  cards: PlayingCard[][];
  combinations: string[];
  win: number;
  timestamp: Date;
  bonusTriggered?: boolean;
}

interface PokerCombination {
  name: string;
  multiplier: number;
  description: string;
}

const POKER_COMBINATIONS: PokerCombination[] = [
  { name: 'Роял Флеш', multiplier: 250, description: 'A-K-Q-J-10 одной масти' },
  { name: 'Стрит Флеш', multiplier: 50, description: '5 карт подряд одной масти' },
  { name: 'Каре', multiplier: 25, description: '4 карты одного ранга' },
  { name: 'Фулл Хаус', multiplier: 9, description: 'Тройка + пара' },
  { name: 'Флеш', multiplier: 6, description: '5 карт одной масти' },
  { name: 'Стрит', multiplier: 5, description: '5 карт подряд' },
  { name: 'Тройка', multiplier: 4, description: '3 карты одного ранга' },
  { name: 'Две пары', multiplier: 3, description: '2 пары карт' },
  { name: 'Пара', multiplier: 2, description: '2 карты одного ранга' },
];

const Index = () => {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(100);
  const [cardRows, setCardRows] = useState<PlayingCard[][]>([[], [], []]);
  const [isDealing, setIsDealing] = useState(false);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlayCount, setAutoPlayCount] = useState(10);
  const [currentAutoPlay, setCurrentAutoPlay] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [totalGames, setTotalGames] = useState(0);

  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits: Suit[] = ['♠', '♥', '♦', '♣'];

  const getRandomCard = (): PlayingCard => {
    const lowRanks = ['2', '3', '4', '5', '6', '7', '8', '9'];
    const weightedRanks = [
      ...lowRanks, ...lowRanks, ...lowRanks, ...lowRanks, ...lowRanks,
      ...lowRanks, ...lowRanks, ...lowRanks, ...lowRanks, ...lowRanks,
      ...ranks
    ];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const rank = weightedRanks[Math.floor(Math.random() * weightedRanks.length)] as Rank;
    return { suit, rank, id: `${rank}${suit}-${Math.random()}` };
  };

  const checkCombination = (hand: PlayingCard[]): { name: string; multiplier: number } => {
    const rankCounts: { [key: string]: number } = {};
    const suitCounts: { [key: string]: number } = {};
    
    hand.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(count => count === 5);
    
    const rankValues: { [key: string]: number } = {
      'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
    };
    const sortedValues = hand.map(c => rankValues[c.rank]).sort((a, b) => a - b);
    const isStraight = sortedValues.every((val, i) => i === 0 || val === sortedValues[i - 1] + 1);
    const isRoyal = isStraight && sortedValues[0] === 10;

    if (isRoyal && isFlush) return { name: 'Роял Флеш', multiplier: 250 };
    if (isStraight && isFlush) return { name: 'Стрит Флеш', multiplier: 50 };
    if (counts[0] === 4) return { name: 'Каре', multiplier: 25 };
    if (counts[0] === 3 && counts[1] === 2) return { name: 'Фулл Хаус', multiplier: 9 };
    if (isFlush) return { name: 'Флеш', multiplier: 6 };
    if (isStraight) return { name: 'Стрит', multiplier: 5 };
    if (counts[0] === 3) return { name: 'Тройка', multiplier: 4 };
    if (counts[0] === 2 && counts[1] === 2) return { name: 'Две пары', multiplier: 3 };
    if (counts[0] === 2) return { name: 'Пара', multiplier: 2 };

    return { name: 'Нет комбинации', multiplier: 0 };
  };

  const dealCards = () => {
    if (bonusSpins === 0 && balance < betAmount) {
      toast.error('Недостаточно средств!');
      return;
    }

    setIsDealing(true);
    setLastWin(0);
    
    if (bonusSpins > 0) {
      setBonusSpins(prev => prev - 1);
      toast.info(`Бонусный спин! Осталось: ${bonusSpins - 1}`);
    } else {
      setBalance(prev => prev - betAmount);
    }

    setTotalGames(prev => prev + 1);

    const newRows: PlayingCard[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowCards: PlayingCard[] = [];
      for (let i = 0; i < 5; i++) {
        rowCards.push(getRandomCard());
      }
      newRows.push(rowCards);
    }
    
    setCardRows(newRows);

    setTimeout(() => {
      const results = newRows.map(row => checkCombination(row));
      const totalMultiplier = results.reduce((sum, r) => sum + r.multiplier, 0);
      const winAmount = totalMultiplier * betAmount;
      
      if (winAmount > 0) {
        setBalance(prev => prev + winAmount);
        setLastWin(winAmount);
        const combos = results.filter(r => r.multiplier > 0).map(r => r.name).join(', ');
        toast.success(`${combos}! Выигрыш: ${winAmount} ₽`);
      } else {
        toast.error('Нет выигрышных комбинаций');
      }

      if (totalGames > 0 && totalGames % 20 === 0) {
        const bonusAmount = Math.floor(Math.random() * 3) + 3;
        setBonusSpins(bonusAmount);
        toast.success(`🎉 Бонус! ${bonusAmount} бесплатных спинов!`, { duration: 5000 });
      }

      const gameRecord: GameHistory = {
        id: Date.now().toString(),
        bet: betAmount,
        cards: newRows,
        combinations: results.map(r => r.name),
        win: winAmount,
        timestamp: new Date(),
        bonusTriggered: totalGames % 20 === 0,
      };
      
      setHistory(prev => [gameRecord, ...prev].slice(0, 20));
      setIsDealing(false);
    }, 2500);
  };

  useEffect(() => {
    if (autoPlay && currentAutoPlay < autoPlayCount) {
      const timer = setTimeout(() => {
        dealCards();
        setCurrentAutoPlay(prev => prev + 1);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (currentAutoPlay >= autoPlayCount) {
      setAutoPlay(false);
      setCurrentAutoPlay(0);
      toast.info('Автоигра завершена');
    }
  }, [autoPlay, currentAutoPlay, autoPlayCount]);

  const startAutoPlay = () => {
    if (balance < betAmount * autoPlayCount) {
      toast.error('Недостаточно средств для автоигры!');
      return;
    }
    setCurrentAutoPlay(0);
    setAutoPlay(true);
  };

  const stopAutoPlay = () => {
    setAutoPlay(false);
    setCurrentAutoPlay(0);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary animate-pulse-gold">
            🎰 Poker Bounty Showdown 🎰
          </h1>
          <div className="flex justify-center items-center gap-4 text-xl md:text-2xl flex-wrap">
            <Badge variant="outline" className="text-lg px-4 py-2 bg-card">
              <Icon name="Coins" className="mr-2" size={20} />
              Баланс: {balance} ₽
            </Badge>
            {bonusSpins > 0 && (
              <Badge className="text-lg px-4 py-2 bg-accent text-accent-foreground animate-pulse-gold">
                <Icon name="Gift" className="mr-2" size={20} />
                Бонус: {bonusSpins} спинов
              </Badge>
            )}
            {lastWin > 0 && (
              <Badge className="text-lg px-4 py-2 bg-primary text-primary-foreground animate-win-glow">
                <Icon name="TrendingUp" className="mr-2" size={20} />
                Выигрыш: +{lastWin} ₽
              </Badge>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-gradient-to-br from-card to-muted border-2 border-primary/30">
              <div className="space-y-3">
                {cardRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-5 gap-2">
                    {row.length === 0 ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-[2/3] bg-muted border-2 border-border rounded-lg flex items-center justify-center"
                        >
                          <Icon name="HelpCircle" size={32} className="text-muted-foreground" />
                        </div>
                      ))
                    ) : (
                      row.map((card, i) => (
                        <div
                          key={card.id}
                          className="aspect-[2/3] bg-white text-black border-4 border-accent rounded-lg flex flex-col items-center justify-center text-2xl md:text-4xl font-bold shadow-lg animate-deal-card"
                          style={{ animationDelay: `${(rowIndex * 5 + i) * 0.05}s` }}
                        >
                          <div className={card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}>
                            {card.rank}
                          </div>
                          <div className={card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}>
                            {card.suit}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-card space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bet">Размер ставки (₽)</Label>
                  <Input
                    id="bet"
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value)))}
                    min={10}
                    disabled={isDealing || autoPlay}
                    className="text-lg"
                  />
                  <div className="flex gap-2">
                    {[50, 100, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        size="sm"
                        variant="outline"
                        onClick={() => setBetAmount(amount)}
                        disabled={isDealing || autoPlay}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="autocount">Автоигры (раунды)</Label>
                  <Input
                    id="autocount"
                    type="number"
                    value={autoPlayCount}
                    onChange={(e) => setAutoPlayCount(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={100}
                    disabled={isDealing || autoPlay}
                    className="text-lg"
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoplay"
                      checked={autoPlay}
                      onCheckedChange={(checked) => checked ? startAutoPlay() : stopAutoPlay()}
                      disabled={isDealing}
                    />
                    <Label htmlFor="autoplay">
                      {autoPlay ? `Автоигра ${currentAutoPlay}/${autoPlayCount}` : 'Автоигра'}
                    </Label>
                  </div>
                </div>
              </div>

              <Button
                onClick={dealCards}
                disabled={isDealing || autoPlay || balance < betAmount}
                className="w-full text-xl py-6 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                {isDealing ? (
                  <>
                    <Icon name="Loader2" className="mr-2 animate-spin" size={24} />
                    Раздача карт...
                  </>
                ) : (
                  <>
                    <Icon name="Play" className="mr-2" size={24} />
                    Играть (Ставка: {betAmount} ₽)
                  </>
                )}
              </Button>
            </Card>
          </div>

          <div className="space-y-6">
            <Tabs defaultValue="rules" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rules">
                  <Icon name="BookOpen" className="mr-2" size={16} />
                  Правила
                </TabsTrigger>
                <TabsTrigger value="history">
                  <Icon name="History" className="mr-2" size={16} />
                  История
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="rules" className="space-y-2">
                <Card className="p-4 bg-card max-h-[600px] overflow-y-auto">
                  <h3 className="text-lg font-heading font-bold mb-4 text-primary">Комбинации и выплаты</h3>
                  <div className="space-y-2">
                    {POKER_COMBINATIONS.map((combo) => (
                      <Card key={combo.name} className="p-3 bg-muted hover:bg-muted/80 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-foreground">{combo.name}</div>
                            <div className="text-sm text-muted-foreground">{combo.description}</div>
                          </div>
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            x{combo.multiplier}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-accent/20 rounded-lg border border-accent">
                    <h4 className="font-bold text-foreground mb-2 flex items-center">
                      <Icon name="Gift" className="mr-2" size={20} />
                      Бонусная система
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Каждые 20 игр вы получаете 3-5 бесплатных спинов!
                    </p>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-2">
                <Card className="p-4 bg-card max-h-[600px] overflow-y-auto">
                  <h3 className="text-lg font-heading font-bold mb-4 text-primary">Последние игры</h3>
                  {history.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Icon name="Clock" size={48} className="mx-auto mb-2 opacity-50" />
                      <p>История игр пуста</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((game) => (
                        <Card key={game.id} className={`p-3 ${game.bonusTriggered ? 'bg-accent/20 border-accent' : 'bg-muted'}`}>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                {game.bonusTriggered && <Icon name="Gift" size={16} className="text-accent" />}
                                <span className="font-bold text-foreground text-sm">
                                  {game.combinations.filter(c => c !== 'Нет комбинации').join(', ') || 'Проигрыш'}
                                </span>
                              </div>
                              <Badge variant={game.win > 0 ? 'default' : 'destructive'}>
                                {game.win > 0 ? `+${game.win}` : `-${game.bet}`} ₽
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              {game.cards.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex gap-1">
                                  {row.map((card) => (
                                    <div
                                      key={card.id}
                                      className="text-xs bg-white px-1 py-0.5 rounded border border-accent"
                                    >
                                      <span className={card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}>
                                        {card.rank}{card.suit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {game.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;