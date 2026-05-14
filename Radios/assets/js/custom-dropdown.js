/**
 * Custom Category Dropdown
 * Supports: hover/click toggle, outside click close, keyboard navigation,
 * staggered animations, and syncs with the hidden native <select>.
 */
(function ($) {
  'use strict';

  var CLOSE_ANIM_DURATION = 200; // ms — matches CSS animation
  var HOVER_DELAY = 150; // ms — prevents flicker on hover

  $(document).ready(function () {
    var $dropdown = $('#customCategoryDropdown');
    var $menu = $('#customCategoryMenu');
    var $items = $menu.find('.custom-category-dropdown__item');
    var $textEl = $dropdown.find('.custom-category-dropdown__text');
    var $nativeSelect = $('#category');
    var hoverTimer = null;
    var closeTimer = null;
    var focusIndex = -1;

    // Mark the default active item
    $items.first().addClass('is-active');

    // ——— Open / Close helpers ———

    function openDropdown() {
      clearTimeout(closeTimer);
      if ($dropdown.hasClass('is-open')) return;
      $dropdown.removeClass('is-closing');
      $dropdown.addClass('is-open');
      $dropdown.attr('aria-expanded', 'true');
      focusIndex = -1;
    }

    function closeDropdown(immediate) {
      clearTimeout(closeTimer);
      if (!$dropdown.hasClass('is-open')) return;

      if (immediate) {
        $dropdown.removeClass('is-open is-closing');
        $dropdown.attr('aria-expanded', 'false');
        return;
      }

      $dropdown.addClass('is-closing');
      closeTimer = setTimeout(function () {
        $dropdown.removeClass('is-open is-closing');
        $dropdown.attr('aria-expanded', 'false');
        clearFocus();
      }, CLOSE_ANIM_DURATION);
    }

    function toggleDropdown() {
      if ($dropdown.hasClass('is-open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    }

    // ——— Selection ———

    function selectItem($item) {
      var value = $item.data('value');
      var text = $item.text();

      $items.removeClass('is-active');
      $item.addClass('is-active');
      $textEl.text(text);

      // Sync native select
      $nativeSelect.val(value !== undefined ? value : '');

      closeDropdown();
    }

    // ——— Focus management (keyboard) ———

    function clearFocus() {
      $items.removeClass('is-focused');
      focusIndex = -1;
    }

    function setFocus(index) {
      $items.removeClass('is-focused');
      if (index < 0) index = $items.length - 1;
      if (index >= $items.length) index = 0;
      focusIndex = index;
      $items.eq(focusIndex).addClass('is-focused');

      // Scroll into view if needed
      var item = $items.eq(focusIndex)[0];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }

    // ——— Event: Click on trigger ———
    $dropdown.find('.custom-category-dropdown__selected').on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    });

    // ——— Event: Click on item ———
    $items.on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      selectItem($(this));
    });

    // ——— Event: Hover interaction ———
    $dropdown.on('mouseenter', function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        openDropdown();
      }, HOVER_DELAY);
    });

    $dropdown.on('mouseleave', function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        closeDropdown();
      }, HOVER_DELAY);
    });

    // ——— Event: Outside click close ———
    $(document).on('click', function (e) {
      if (!$dropdown.is(e.target) && $dropdown.has(e.target).length === 0) {
        closeDropdown();
      }
    });

    // ——— Event: Keyboard navigation ———
    $dropdown.on('keydown', function (e) {
      var key = e.key || e.keyCode;

      switch (key) {
        case 'Enter':
        case 13:
          e.preventDefault();
          if (!$dropdown.hasClass('is-open')) {
            openDropdown();
          } else if (focusIndex >= 0) {
            selectItem($items.eq(focusIndex));
          }
          break;

        case ' ':
        case 32:
          e.preventDefault();
          if (!$dropdown.hasClass('is-open')) {
            openDropdown();
          } else if (focusIndex >= 0) {
            selectItem($items.eq(focusIndex));
          }
          break;

        case 'ArrowDown':
        case 40:
          e.preventDefault();
          if (!$dropdown.hasClass('is-open')) {
            openDropdown();
          }
          setFocus(focusIndex + 1);
          break;

        case 'ArrowUp':
        case 38:
          e.preventDefault();
          if (!$dropdown.hasClass('is-open')) {
            openDropdown();
          }
          setFocus(focusIndex - 1);
          break;

        case 'Escape':
        case 27:
          e.preventDefault();
          closeDropdown();
          $dropdown.focus();
          break;

        case 'Tab':
        case 9:
          closeDropdown(true);
          break;
      }
    });

    // ——— Prevent form submit on dropdown keyboard interaction ———
    $dropdown.closest('form').on('keydown', function (e) {
      if ((e.key === 'Enter' || e.keyCode === 13) && $dropdown.hasClass('is-open')) {
        e.preventDefault();
      }
    });
  });
})(jQuery);
