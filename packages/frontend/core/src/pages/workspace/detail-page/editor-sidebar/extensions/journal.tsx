import {
  type DateCell,
  DatePicker,
  IconButton,
  Menu,
  Scrollable,
} from '@affine/component';
import { MoveToTrash } from '@affine/core/components/page-list';
import { useTrashModalHelper } from '@affine/core/hooks/affine/use-trash-modal-helper';
import { useBlockSuitePageMeta } from '@affine/core/hooks/use-block-suite-page-meta';
import { useBlockSuiteWorkspacePageTitle } from '@affine/core/hooks/use-block-suite-workspace-page-title';
import {
  useJournalHelper,
  useJournalInfoHelper,
  useJournalRouteHelper,
} from '@affine/core/hooks/use-journal';
import { useNavigateHelper } from '@affine/core/hooks/use-navigate-helper';
import type { BlockSuiteWorkspace } from '@affine/core/shared';
import { useAFFiNEI18N } from '@affine/i18n/hooks';
import {
  EdgelessIcon,
  MoreHorizontalIcon,
  PageIcon,
  TodayIcon,
} from '@blocksuite/icons';
import type { Page, PageMeta } from '@blocksuite/store';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import clsx from 'clsx';
import dayjs from 'dayjs';
import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EditorExtension, EditorExtensionProps } from '..';
import * as styles from './journal.css';

/**
 * @internal
 */
const CountDisplay = ({
  count,
  max = 99,
  ...attrs
}: { count: number; max?: number } & HTMLAttributes<HTMLSpanElement>) => {
  return <span {...attrs}>{count > max ? `${max}+` : count}</span>;
};
interface PageItemProps extends HTMLAttributes<HTMLDivElement> {
  pageMeta: PageMeta;
  workspace: BlockSuiteWorkspace;
  right?: ReactNode;
}
const PageItem = ({
  pageMeta,
  workspace,
  right,
  className,
  ...attrs
}: PageItemProps) => {
  const { isJournal } = useJournalInfoHelper(workspace, pageMeta.id);
  const title = useBlockSuiteWorkspacePageTitle(workspace, pageMeta.id);

  const Icon = isJournal
    ? TodayIcon
    : pageMeta.mode === 'edgeless'
      ? EdgelessIcon
      : PageIcon;
  return (
    <div
      aria-label={pageMeta.title}
      className={clsx(className, styles.pageItem)}
      {...attrs}
    >
      <div className={styles.pageItemIcon}>
        <Icon width={20} height={20} />
      </div>
      <span className={styles.pageItemLabel}>{title}</span>
      {right}
    </div>
  );
};

type NavItemName = 'createdToday' | 'updatedToday';
interface NavItem {
  name: NavItemName;
  label: string;
  count: number;
}
interface JournalBlockProps extends EditorExtensionProps {
  date: dayjs.Dayjs;
}

const EditorJournalPanel = (props: EditorExtensionProps) => {
  const { workspace, page } = props;
  const t = useAFFiNEI18N();
  const { journalDate, isJournal } = useJournalInfoHelper(
    page.workspace,
    page.id
  );
  const { openJournal } = useJournalRouteHelper(workspace);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    journalDate && setDate(journalDate.format('YYYY-MM-DD'));
  }, [journalDate]);

  const onDateSelect = useCallback(
    (date: string) => {
      if (journalDate && dayjs(date).isSame(dayjs(journalDate))) return;
      openJournal(date);
    },
    [journalDate, openJournal]
  );

  const customDayRenderer = useCallback(
    (cell: DateCell) => {
      // TODO: add a dot to indicate journal
      // has performance issue for now, better to calculate it in advance
      // const hasJournal = !!getJournalsByDate(cell.date.format('YYYY-MM-DD'))?.length;
      const hasJournal = false;
      return (
        <button
          className={styles.journalDateCell}
          data-is-date-cell
          tabIndex={cell.focused ? 0 : -1}
          data-is-today={cell.isToday}
          data-not-current-month={cell.notCurrentMonth}
          data-selected={cell.selected}
          data-is-journal={isJournal}
          data-has-journal={hasJournal}
        >
          {cell.label}
          {hasJournal && !cell.selected ? (
            <div className={styles.journalDateCellDot} />
          ) : null}
        </button>
      );
    },
    [isJournal]
  );

  return (
    <div className={styles.journalPanel} data-is-journal={isJournal}>
      <div className={styles.calendar}>
        <DatePicker
          weekDays={t['com.affine.calendar-date-picker.week-days']()}
          monthNames={t['com.affine.calendar-date-picker.month-names']()}
          todayLabel={t['com.affine.calendar-date-picker.today']()}
          customDayRenderer={customDayRenderer}
          value={date}
          onChange={onDateSelect}
        />
      </div>
      <JournalConflictBlock date={dayjs(date)} {...props} />
      <JournalDailyCountBlock date={dayjs(date)} {...props} />
    </div>
  );
};

const sortPagesByDate = (
  pages: PageMeta[],
  field: 'updatedDate' | 'createDate',
  order: 'asc' | 'desc' = 'desc'
) => {
  return [...pages].sort((a, b) => {
    return (order === 'asc' ? 1 : -1) * dayjs(b[field]).diff(dayjs(a[field]));
  });
};

const DailyCountEmptyFallback = ({ name }: { name: NavItemName }) => {
  const t = useAFFiNEI18N();

  return (
    <div className={styles.dailyCountEmpty}>
      {name === 'createdToday'
        ? t['com.affine.journal.daily-count-created-empty-tips']()
        : t['com.affine.journal.daily-count-updated-empty-tips']()}
    </div>
  );
};
const JournalDailyCountBlock = ({ workspace, date }: JournalBlockProps) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const t = useAFFiNEI18N();
  const [activeItem, setActiveItem] = useState<NavItemName>('createdToday');
  const pageMetas = useBlockSuitePageMeta(workspace);

  const navigateHelper = useNavigateHelper();

  const getTodaysPages = useCallback(
    (field: 'createDate' | 'updatedDate') => {
      return sortPagesByDate(
        pageMetas.filter(pageMeta => {
          if (pageMeta.trash) return false;
          return pageMeta[field] && dayjs(pageMeta[field]).isSame(date, 'day');
        }),
        field
      );
    },
    [date, pageMetas]
  );

  const createdToday = useMemo(
    () => getTodaysPages('createDate'),
    [getTodaysPages]
  );
  const updatedToday = useMemo(
    () => getTodaysPages('updatedDate'),
    [getTodaysPages]
  );

  const headerItems = useMemo<NavItem[]>(
    () => [
      {
        name: 'createdToday',
        label: t['com.affine.journal.created-today'](),
        count: createdToday.length,
      },
      {
        name: 'updatedToday',
        label: t['com.affine.journal.updated-today'](),
        count: updatedToday.length,
      },
    ],
    [createdToday.length, t, updatedToday.length]
  );

  const activeIndex = headerItems.findIndex(({ name }) => name === activeItem);

  const vars = assignInlineVars({
    '--active-index': String(activeIndex),
    '--item-count': String(headerItems.length),
  });

  return (
    <div className={styles.dailyCount} style={vars}>
      <header className={styles.dailyCountHeader}>
        {headerItems.map(({ label, count, name }, index) => {
          return (
            <button
              onClick={() => setActiveItem(name)}
              aria-selected={activeItem === name}
              className={styles.dailyCountNav}
              key={index}
            >
              {label}
              &nbsp;
              <CountDisplay count={count} />
            </button>
          );
        })}
      </header>

      <main className={styles.dailyCountContainer} data-active={activeItem}>
        {headerItems.map(({ name }) => {
          const renderList =
            name === 'createdToday' ? createdToday : updatedToday;
          if (renderList.length === 0)
            return (
              <div key={name} className={styles.dailyCountItem}>
                <DailyCountEmptyFallback name={name} />
              </div>
            );
          return (
            <Scrollable.Root key={name} className={styles.dailyCountItem}>
              <Scrollable.Scrollbar />
              <Scrollable.Viewport>
                <div className={styles.dailyCountContent} ref={nodeRef}>
                  {renderList.map((pageMeta, index) => (
                    <PageItem
                      onClick={() =>
                        navigateHelper.openPage(workspace.id, pageMeta.id)
                      }
                      tabIndex={name === activeItem ? 0 : -1}
                      key={index}
                      pageMeta={pageMeta}
                      workspace={workspace}
                    />
                  ))}
                </div>
              </Scrollable.Viewport>
            </Scrollable.Root>
          );
        })}
      </main>
    </div>
  );
};

const MAX_CONFLICT_COUNT = 5;
interface ConflictListProps
  extends JournalBlockProps,
    PropsWithChildren,
    HTMLAttributes<HTMLDivElement> {
  pages: Page[];
}
const ConflictList = ({
  page: currentPage,
  pages,
  workspace,
  children,
  className,
  ...attrs
}: ConflictListProps) => {
  const navigateHelper = useNavigateHelper();
  const { setTrashModal } = useTrashModalHelper(workspace);

  const handleOpenTrashModal = useCallback(
    (page: Page) => {
      if (!page.meta) return;
      setTrashModal({
        open: true,
        pageIds: [page.id],
        pageTitles: [page.meta.title],
      });
    },
    [setTrashModal]
  );

  return (
    <div className={clsx(styles.journalConflictWrapper, className)} {...attrs}>
      {pages.map(page => {
        const isCurrent = page.id === currentPage.id;
        return (
          <PageItem
            aria-label={page.meta.title}
            aria-selected={isCurrent}
            pageMeta={page.meta}
            workspace={workspace}
            key={page.id}
            right={
              <Menu
                items={
                  <MoveToTrash onSelect={() => handleOpenTrashModal(page)} />
                }
              >
                <IconButton type="plain">
                  <MoreHorizontalIcon />
                </IconButton>
              </Menu>
            }
            onClick={() => navigateHelper.openPage(workspace.id, page.id)}
          />
        );
      })}
      {children}
    </div>
  );
};
const JournalConflictBlock = (props: JournalBlockProps) => {
  const { workspace, date } = props;
  const t = useAFFiNEI18N();
  const journalHelper = useJournalHelper(workspace);
  const pages = journalHelper.getJournalsByDate(date.format('YYYY-MM-DD'));

  if (pages.length <= 1) return null;

  return (
    <ConflictList
      className={styles.journalConflictBlock}
      pages={pages.slice(0, MAX_CONFLICT_COUNT)}
      {...props}
    >
      {pages.length > MAX_CONFLICT_COUNT ? (
        <Menu
          items={
            <ConflictList pages={pages.slice(MAX_CONFLICT_COUNT)} {...props} />
          }
        >
          <div className={styles.journalConflictMoreTrigger}>
            {t['com.affine.journal.conflict-show-more']({
              count: (pages.length - MAX_CONFLICT_COUNT).toFixed(0),
            })}
          </div>
        </Menu>
      ) : null}
    </ConflictList>
  );
};

export const journalExtension: EditorExtension = {
  name: 'journal',
  icon: <TodayIcon />,
  Component: EditorJournalPanel,
};
